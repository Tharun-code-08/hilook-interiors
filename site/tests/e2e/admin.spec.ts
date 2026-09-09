import { test, expect, type Page } from "@playwright/test";

/**
 * Admin flows.
 *
 * The seeded account is created by db:migrate with ADMIN_INITIAL_PASSWORD
 * (set in playwright.config.ts) and is flagged mustChangePassword, so the
 * first sign-in lands on the change-password screen rather than the
 * dashboard — that forced rotation is itself one of the things under test.
 */

const USERNAME = "admin";
const SEED_PASSWORD = "e2e-admin-password-1234";
const NEW_PASSWORD = "e2e-rotated-password-5678";

/**
 * Signs in and ends on the dashboard, whichever password is currently live.
 *
 * The suite is idempotent by necessity: the forced-rotation test below
 * changes the password, so a re-run (or a Playwright retry) starts from a
 * different state than a fresh database does. Every navigation here is a
 * client-side push, so URLs are asserted by polling rather than with
 * waitForURL, which waits on a `load` event that soft navigation never fires.
 */
async function signIn(page: Page): Promise<void> {
  await page.goto("/admin/login");

  for (const password of [NEW_PASSWORD, SEED_PASSWORD]) {
    await page.getByLabel("Username").fill(USERNAME);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Either we're through, or the credential was wrong and we try the other.
    await page.waitForTimeout(1200);
    if (!page.url().includes("/admin/login")) break;
  }

  // A freshly seeded account lands on the forced change screen first.
  if (page.url().includes("/admin/password")) {
    await rotatePassword(page, SEED_PASSWORD, NEW_PASSWORD);
  }

  await expect(page).toHaveURL(/\/admin(?!\/login)/);
}

async function rotatePassword(page: Page, from: string, to: string): Promise<void> {
  await page.locator("#current-password").fill(from);
  await page.locator("#new-password").fill(to);
  await page.locator("#confirm-password").fill(to);
  await page.getByRole("button", { name: /update password/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
}

test.describe("authentication", () => {
  test("unauthenticated admin pages redirect to login, preserving the destination", async ({
    page,
  }) => {
    await page.goto("/admin/portfolio");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fportfolio/);
  });

  test("the admin API returns 401, not a redirect", async ({ request }) => {
    const res = await request.get("/api/admin/portfolio");
    expect(res.status()).toBe(401);
  });

  test("rejects a wrong password without revealing whether the user exists", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Username").fill("no-such-user-here");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password-entirely");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Identical message for an unknown user and a wrong password.
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test("a seeded account cannot reach the panel without rotating its password", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Username").fill(USERNAME);
    await page.getByLabel("Password", { exact: true }).fill(SEED_PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForTimeout(1200);

    if (page.url().includes("/admin/password")) {
      // Fresh database: the account ships flagged, so sign-in must land here
      // and not on the dashboard.
      await expect(page.getByRole("heading", { name: /set a new password/i })).toBeVisible();
      await rotatePassword(page, SEED_PASSWORD, NEW_PASSWORD);
    } else {
      // Already rotated by an earlier run — assert the seed password is dead,
      // which is the same property from the other side.
      await expect(page).toHaveURL(/\/admin\/login/);
      await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    }
  });
});

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("shows real analytics rather than placeholders", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByText(/views \(7 days\)/i)).toBeVisible();
    await expect(page.getByText("Unique visitors (7 days)")).toBeVisible();
    await expect(page.getByText(/enquiry funnel/i)).toBeVisible();
    await expect(page.getByText(/recent activity/i)).toBeVisible();
  });
});

test.describe("CRUD round trip", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  /**
   * These call the API from inside the page rather than through Playwright's
   * request fixture, which keeps its own cookie jar and never sees the session
   * established by signing in. Fetching in-page is also the path the real
   * admin client takes, so it exercises the CSRF handshake end to end.
   */
  async function apiCall(
    page: Page,
    url: string,
    init: { method: string; body?: unknown; withCsrf?: boolean }
  ): Promise<{ status: number; body: Record<string, unknown> | null }> {
    return page.evaluate(
      async ({ url, init }) => {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (init.withCsrf !== false) {
          const match = document.cookie.match(/hilook_csrf=([^;]+)/);
          headers["x-hilook-csrf"] = match ? match[1] : "";
        }
        const res = await fetch(url, {
          method: init.method,
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
        const text = await res.text();
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = null;
        }
        return { status: res.status, body: parsed };
      },
      { url, init }
    );
  }

  test("create, partial update, and delete a project without losing data", async ({ page }) => {
    const created = await apiCall(page, "/api/admin/portfolio", {
      method: "POST",
      body: {
        title: "E2E Round Trip",
        category: "Commercial",
        description: "MUST SURVIVE",
        images: ["/images/about/featured.jpg", "/images/about/featured.jpg"],
      },
    });

    expect(created.status).toBe(201);
    const project = created.body as { id: string; slug: string; images: string[] };
    expect(project.slug).toBe("e2e-round-trip");
    expect(project.images).toHaveLength(2);

    // The regression: a title-only update must not wipe anything else.
    const updated = await apiCall(page, `/api/admin/portfolio/${project.id}`, {
      method: "PUT",
      body: { title: "E2E Renamed" },
    });
    expect(updated.status).toBe(200);

    const after = updated.body as {
      title: string;
      category: string;
      description: string;
      images: string[];
    };
    expect(after.title).toBe("E2E Renamed");
    expect(after.category).toBe("Commercial");
    expect(after.description).toBe("MUST SURVIVE");
    expect(after.images).toHaveLength(2);

    const removed = await apiCall(page, `/api/admin/portfolio/${project.id}`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);
  });

  test("mutations without a CSRF token are refused", async ({ page }) => {
    // Session cookie present, token withheld — the cross-site POST shape.
    const res = await apiCall(page, "/api/admin/services", {
      method: "POST",
      body: { name: "Should Not Be Created" },
      withCsrf: false,
    });
    expect(res.status).toBe(403);
  });

  test("a rejected save surfaces an error rather than appearing to succeed", async ({ page }) => {
    // An empty name fails validation; the response must say why, which is what
    // the toast and the inline field error render.
    const res = await apiCall(page, "/api/admin/services", {
      method: "POST",
      body: { name: "" },
    });

    expect(res.status).toBe(400);
    expect(String(res.body?.error)).toMatch(/required/i);
    expect(res.body?.fieldErrors).toHaveProperty("name");
  });
});

test.describe("security headers", () => {
  test("every response carries the hardening headers", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();

    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

test.describe("public endpoint hardening", () => {
  test("the section beacon rejects names outside the allowlist", async ({ request }) => {
    // Unbounded names would grow the analytics key space forever.
    const bad = await request.post("/api/analytics/section", {
      data: { section: `invented-${Date.now()}` },
    });
    expect(bad.status()).toBe(400);

    const good = await request.post("/api/analytics/section", { data: { section: "about" } });
    expect(good.ok()).toBe(true);
  });

  test("the contact form silently discards a honeypot submission", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: {
        name: "Spam Bot",
        email: "bot@example.com",
        message: "Buy cheap things",
        website: "http://spam.example",
      },
    });

    // 200 on purpose: telling a bot which check it tripped teaches evasion.
    expect(res.ok()).toBe(true);
  });
});
