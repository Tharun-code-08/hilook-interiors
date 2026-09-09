import { test, expect, request, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
  // By label, not by id. These fields used to carry hand-written ids; they now
  // come from the TextField primitive, which generates its own via useId. The
  // ids changing broke this helper silently — silently because signIn only
  // reaches it on a database where the seeded password has not been rotated
  // yet, so a suite run against an already-used e2e database still passed. CI
  // starts from a clean checkout and would not have.
  await page.getByLabel("Current password", { exact: true }).fill(from);
  await page.getByLabel("New password", { exact: true }).fill(to);
  await page.getByLabel("Confirm new password", { exact: true }).fill(to);
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
      // Already rotated — the seed password must not grant access.
      //
      // Asserted as "did not reach the panel" rather than by matching the
      // error text. The chromium and mobile projects share one e2e database,
      // so by the time this runs the login limiter may already have tripped
      // and the reply is "too many attempts" rather than "invalid
      // credentials". Both are refusals; this test cares that the door stayed
      // shut, and pinning the wording made it pass or fail depending on which
      // project happened to run first.
      await expect(page).toHaveURL(/\/admin\/login/);
      await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
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

/**
 * Session revocation.
 *
 * The session cookie is a JWT, so for most of this project's life signing out
 * only deleted the cookie — a token captured beforehand stayed valid for the
 * rest of its seven days. These tests hold a copy of the token and try to use
 * it after the fact, because that is the only way to tell real revocation from
 * a cleared cookie.
 */
/**
 * Lead capture, end to end.
 *
 * The suite covered both ways a contact submission can be *rejected* — a bad
 * email, and the honeypot — and no way it can succeed. For a studio whose
 * enquiries are the business, the path with no test was the one that matters
 * most: a visitor fills the form in, and it reaches the inbox.
 *
 * The wait is not padding. app/api/contact/route.ts discards anything
 * submitted within MIN_FILL_MS (3s) of the form rendering, on the reasoning
 * that no human loads a page and submits inside three seconds. A test that
 * fills instantly is indistinguishable from the bots that check exists for and
 * gets the same silent 200 — which is exactly what happened the first time
 * this was written.
 */
test.describe("contact form reaches the inbox", () => {
  test("a genuine enquiry is stored and appears in the admin inbox", async ({ page }) => {
    const marker = `Walkthrough Client ${Date.now()}`;

    await page.goto("/");
    await page.locator("#contact").scrollIntoViewIfNeeded();

    await page.getByLabel("Your name").fill(marker);
    await page.getByLabel("Your email address").fill("enquiry@example.com");
    await page.getByLabel("How can we help?").fill("Please quote for a full-home design.");

    // Clear MIN_FILL_MS, or the endpoint treats this as a bot and silently
    // returns success without storing anything.
    await page.waitForTimeout(3400);
    await page.getByRole("button", { name: /send inquiry/i }).click();

    await expect(page.getByText(/thank you/i)).toBeVisible({ timeout: 10_000 });

    await signIn(page);
    await page.goto("/admin/submissions");
    await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 });
  });
});

/**
 * Flagged submissions are kept, not dropped.
 *
 * The contact endpoint used to discard anything a spam check caught and return
 * the normal success shape, so a false positive lost a client enquiry with
 * nothing behind it but a console warning. The checks are heuristics — a
 * password manager can fill the honeypot, and the timing window is a guess
 * about how fast a person moves — and on a site whose enquiries are the
 * business, that is the wrong direction to fail in.
 *
 * The visitor still sees success either way; telling a bot which check it
 * tripped teaches the author to evade it. What changed is that the row
 * survives for a human to look at.
 */
test.describe("flagged submissions", () => {
  test("a honeypot hit is stored for review rather than discarded", async ({ page, request }) => {
    const marker = `Honeypot Probe ${Date.now()}`;

    const res = await request.post("/api/contact", {
      data: {
        name: marker,
        email: "probe@example.com",
        phone: "",
        message: "Caught by the hidden field.",
        website: "http://spam.example",
      },
    });

    // Indistinguishable from a real success, on purpose.
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    await signIn(page);
    await page.goto("/admin/submissions");

    // Not in the real inbox...
    await expect(page.getByText(marker)).toHaveCount(0);

    // ...but held under Filtered, with the reason it was caught.
    await page.getByRole("tab", { name: /filtered/i }).click();
    await expect(page.getByText(marker)).toBeVisible();
    await expect(page.getByText(/hidden field/i).first()).toBeVisible();
  });

  test("a filtered message can be restored to the inbox", async ({ page, request }) => {
    const marker = `Rescue Probe ${Date.now()}`;

    await request.post("/api/contact", {
      data: {
        name: marker,
        email: "rescue@example.com",
        phone: "",
        message: "A real client the checks got wrong.",
        website: "http://looks-like-spam.example",
      },
    });

    await signIn(page);
    await page.goto("/admin/submissions");
    await page.getByRole("tab", { name: /filtered/i }).click();
    await expect(page.getByText(marker)).toBeVisible();

    const card = page.locator("article.ad-enquiry").filter({ hasText: marker });
    await card.getByRole("button", { name: /this is a real enquiry/i }).click();

    // Reloaded rather than trusting the optimistic move: the point of the test
    // is that it was persisted.
    await page.goto("/admin/submissions");
    await expect(page.getByText(marker)).toBeVisible();
  });

  test("spam does not inflate the dashboard's enquiry counts", async ({ page, request }) => {
    await signIn(page);
    await page.goto("/admin");
    const before = Number(
      (
        await page
          .locator(".ad-stat")
          .filter({ hasText: /unread enquiries/i })
          .locator(".ad-stat-value")
          .innerText()
      ).trim()
    );

    await request.post("/api/contact", {
      data: {
        name: `Noise ${Date.now()}`,
        email: "noise@example.com",
        phone: "",
        message: "Should not count as a lead.",
        website: "http://spam.example",
      },
    });

    await page.goto("/admin");
    const after = Number(
      (
        await page
          .locator(".ad-stat")
          .filter({ hasText: /unread enquiries/i })
          .locator(".ad-stat-value")
          .innerText()
      ).trim()
    );

    // Stored, but not a lead. Counting it would turn the one number the
    // business watches into whatever spam happened to arrive.
    expect(after).toBe(before);
  });
});

test.describe("session revocation", () => {
  test("a token captured before sign-out stops working after it", async ({ page, context }) => {
    await signIn(page);

    const before = (await context.cookies()).find((c) => c.name === "hilook_session");
    expect(before?.value, "expected a session cookie after signing in").toBeTruthy();

    // Same token, its own request context — nothing shared with the browser
    // beyond the value itself, exactly like a copy taken off a shared machine.
    const stolen = await request.newContext({
      baseURL: page.url().split("/admin")[0],
      extraHTTPHeaders: { Cookie: `hilook_session=${before!.value}` },
    });

    expect((await stolen.get("/api/admin/sessions")).status()).toBe(200);

    await page.getByRole("button", { name: /log out/i }).click();
    await expect(page).toHaveURL(new RegExp("/admin/login"));

    expect(
      (await stolen.get("/api/admin/sessions")).status(),
      "the captured token should be dead after sign-out"
    ).toBe(401);

    await stolen.dispose();
  });

  test("the signed-in device is listed and can be reviewed", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/password");

    await expect(page.getByRole("heading", { name: "Signed-in devices" })).toBeVisible();
    await expect(page.getByText("This device")).toBeVisible();
  });
});

/**
 * Autosave in the edit-in-place lists.
 *
 * These lists used to fire a PUT from onChange, so typing a description was
 * one request per character. The test counts requests rather than trusting the
 * hook, because "it feels fine locally" is exactly how the original survived.
 */
test.describe("autosave", () => {
  test("a burst of typing is one request, not one per keystroke", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/services");

    // The seeded row, targeted by its own field rather than by index. An
    // earlier version created a service first and used .nth(1); the list grows
    // across runs, so that index pointed at a different record each time.
    const target = page.locator("input.ad-input--title").first();
    await expect(target).toBeVisible();

    const puts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes("/api/admin/services/")) {
        puts.push(req.url());
      }
    });

    await target.fill("");
    await target.pressSequentially("Kitchen and bath design", { delay: 60 });

    // Proves the keystrokes landed — without this the request count could be
    // low simply because nothing was typed.
    await expect(target).toHaveValue("Kitchen and bath design");
    await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 5000 });

    // Measured: with the debounce removed this records 24 PUTs for the 23
    // characters below — the behaviour this replaced. With it, 1.
    expect(
      puts.length,
      `expected the burst to coalesce, got ${puts.length} PUTs`
    ).toBeLessThanOrEqual(2);
    expect(puts.length).toBeGreaterThan(0);
  });

  test("an edit still saves when navigating away mid-debounce", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/services");

    const field = page.getByRole("textbox", { name: "Name" }).nth(1);
    await field.fill("Saved on navigate");

    // Leave immediately — well inside the debounce window. The unmount flush
    // is what has to carry this, and losing it is the failure mode a debounce
    // introduces.
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(new RegExp("/admin$"));

    await page.goto("/admin/services");
    await expect(page.getByRole("textbox", { name: "Name" }).nth(1)).toHaveValue(
      "Saved on navigate"
    );
  });
});

/**
 * Accessibility across the authenticated panel.
 *
 * Only /admin/login was ever scanned, which is why roughly a dozen AA contrast
 * failures sat in the dashboard for as long as they did: every admin button
 * used the gold that globals.css marks decoration-only, at 2.86:1. The panel
 * now has its own design system with measured colours, and this is what keeps
 * it that way.
 */
test.describe("admin accessibility", () => {
  // Same reason as the public scans: measure the settled state, not a frame
  // part-way through a transition.
  test.use({ reducedMotion: "reduce" });

  const PAGES = [
    "/admin",
    "/admin/portfolio",
    "/admin/services",
    "/admin/process",
    "/admin/reviews",
    "/admin/awards",
    "/admin/content",
    "/admin/media",
    "/admin/submissions",
    "/admin/activity",
    "/admin/errors",
    "/admin/users",
    "/admin/password",
  ];

  for (const path of PAGES) {
    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      await signIn(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(
        results.violations,
        results.violations.map((v) => `${v.id}: ${v.help}`).join("\n")
      ).toEqual([]);
    });
  }
});
