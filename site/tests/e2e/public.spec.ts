import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("public site", () => {
  test("renders content from the database", async ({ page }) => {
    await page.goto("/");

    // Seeded content — proves the page is reading through the repositories
    // rather than rendering a shell.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("#about")).toBeAttached();
    await expect(page.locator("#services")).toBeAttached();
    await expect(page.locator("#portfolio")).toBeAttached();
    await expect(page.locator("#contact")).toBeAttached();
  });

  test("does not scroll sideways", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The hero used width:100vw, which includes the scrollbar and pushed the
    // whole document 15px wider than the viewport.
    const overflow = await page.evaluate(
      () => document.body.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the skip link is the first tab stop and moves focus to content", async ({ page }) => {
    await page.goto("/");

    // Wait for the link itself rather than domcontentloaded: the home route has
    // a Suspense fallback (app/(home)/loading.tsx), which is on screen at
    // domcontentloaded, before any focusable element exists.
    const skipLink = page.locator("a.hi-skip-link");
    await expect(skipLink).toBeAttached();
    await page.locator("body").click({ position: { x: 0, y: 0 } });

    // Click to give the window keyboard focus, then reload.
    //
    // Both halves are needed. Without a click the page may not hold OS focus
    // and key events go nowhere. But a click also moves Chrome's sequential
    // focus navigation starting point to the clicked node, and the header is
    // position: fixed over the top-left corner — so clicking there began
    // tabbing from the header, past the skip link that precedes it in the DOM,
    // and the first tab stop looked like the "Hilook Interiors" brand link.
    // The reload resets that starting point to the top of the document while
    // the window keeps focus.
    await page.reload();
    await expect(skipLink).toBeAttached();
    await page.keyboard.press("Tab");

    // Assert on the element, not on activeElement text. When focus lands on
    // <body>, reading its textContent returns the whole page and can match by
    // accident.
    await expect(skipLink).toBeFocused();
    expect(await skipLink.textContent()).toMatch(/skip to content/i);

    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeAttached();
  });

  test("the header goes solid only after the hero", async ({ page }) => {
    await page.goto("/");
    const header = page.locator(".hi-header");

    // The state comes from an IntersectionObserver, whose first callback fires
    // a frame or two after mount — assert only once it has reported.
    await expect(header).toBeVisible();
    await page.waitForFunction(() => {
      const el = document.querySelector(".hi-header");
      return el?.getAttribute("data-solid") !== null;
    });

    // Transparent over the cinematic hero…
    await expect(header).toHaveAttribute("data-solid", "false");

    const heroHeight = await page.locator("[data-hero]").evaluate((el) => el.scrollHeight);
    await page.evaluate((y) => window.scrollTo(0, y), heroHeight + 600);

    // …and solid once past it, so dark text never sits on dark footage.
    await expect(header).toHaveAttribute("data-solid", "true", { timeout: 10_000 });
  });

  test("portfolio cards are crawlable links to project pages", async ({ page }) => {
    await page.goto("/");
    await page.locator("#portfolio").scrollIntoViewIfNeeded();

    // Cards animate in via framer-motion's whileInView, so wait for the
    // reveal to finish rather than clicking a still-transparent element.
    const card = page.locator("a.hi-project-card").first();
    await expect(card).toBeVisible();
    await page.waitForTimeout(800);

    // A real href, not a click handler: this is what made projects
    // addressable at all (finding H9).
    const href = await card.getAttribute("href");
    expect(href).toMatch(/^\/work\/[a-z0-9-]+$/);

    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("category filters expose their state to assistive tech", async ({ page }) => {
    await page.goto("/");
    await page.locator("#portfolio").scrollIntoViewIfNeeded();

    const all = page.getByRole("button", { name: "All", exact: true });
    const residential = page.getByRole("button", { name: "Residential", exact: true });

    // Colour alone conveyed this before.
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await residential.click();
    await expect(residential).toHaveAttribute("aria-pressed", "true");
    await expect(all).toHaveAttribute("aria-pressed", "false");
  });

  test("contact form rejects a bad email and reports why", async ({ page }) => {
    await page.goto("/#contact");

    // Scoped to the contact form: the footer newsletter also has an email
    // field, so an unscoped "Email" matches two elements.
    const form = page.locator("#contact form");
    await form.getByPlaceholder("Name").fill("A Person");
    await form.getByPlaceholder("Email", { exact: true }).fill("definitely-not-an-email");
    await form.getByPlaceholder("Message").fill("I would like to discuss a project.");

    // The browser's own validation should stop this before it reaches us.
    const emailValid = await form
      .getByPlaceholder("Email", { exact: true })
      .evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(emailValid).toBe(false);
  });

  test("serves SEO metadata and structured data", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toBeTruthy();
    const parsed = JSON.parse(jsonLd!);
    expect(
      parsed["@graph"].some((n: { "@type": unknown }) =>
        String(n["@type"]).includes("LocalBusiness")
      )
    ).toBe(true);
  });

  test("robots and sitemap are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("Disallow: /admin");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("<urlset");
  });
});

test.describe("project routes", () => {
  test("the work index lists every project as a link", async ({ page }) => {
    await page.goto("/work");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const links = page.locator("a.hi-project-card");
    expect(await links.count()).toBeGreaterThan(0);
  });

  test("a project page carries its own metadata and breadcrumbs", async ({ page }) => {
    await page.goto("/work/hillside-residence");

    // Its own title, not the site-wide one.
    await expect(page).toHaveTitle(/Hillside Residence/);
    await expect(page.getByRole("heading", { level: 1, name: /Hillside Residence/ })).toBeVisible();

    // Canonical points at this project, not the home page.
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toContain("/work/hillside-residence");

    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = blocks.flatMap((b) => JSON.parse(b)).map((n: { "@type": string }) => n["@type"]);
    expect(types).toContain("BreadcrumbList");
  });

  test("an unknown project 404s rather than soft-404ing", async ({ page }) => {
    const res = await page.goto("/work/no-such-project");

    // This returned 200 while rendering the 404 page, because app/loading.tsx
    // was at the app root and flushed the shell — status included — before the
    // page body could call notFound(). Scoping it to app/(home)/ fixed it.
    // A crawler indexes a soft 404 as a real page, so the status is the test.
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: /doesn't exist/i })).toBeVisible();

    const robots = await page.locator('meta[name="robots"]').first().getAttribute("content");
    expect(robots).toContain("noindex");
  });

  test("a real project still returns 200", async ({ page }) => {
    // Guards the other direction: a fix that 404s everything would pass the
    // test above.
    const res = await page.goto("/work/hillside-residence");
    expect(res?.status()).toBe(200);
  });

  test("the sitemap lists every project", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    const xml = await res.text();

    expect(xml).toContain("/work");
    expect(xml).toContain("/work/hillside-residence");
  });

  test("each project has a generated Open Graph image", async ({ request }) => {
    const res = await request.get("/work/hillside-residence/opengraph-image");
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("image/png");
  });
});

/**
 * Content-Security-Policy.
 *
 * script-src carries a per-request nonce instead of 'unsafe-inline', which is
 * the directive that decides whether an injected <script> runs. A nonce only
 * works when the HTML was produced by the request that minted it, so any page
 * Next decides to prerender comes out with unnonced scripts and every one of
 * them is blocked.
 *
 * That is not a loud failure. /admin/login rendered an empty shell with no way
 * to sign in, and the 404 page rendered nothing at all, both while returning
 * a perfectly normal status code. This is the test that catches it, and it has
 * to run over a route of each shape: dynamic, streamed, 404, and the sign-in
 * page that was static until it was made otherwise.
 */
test.describe("content security policy", () => {
  const ROUTES = ["/", "/work", "/admin/login", "/work/no-such-project", "/no-such-page"];

  for (const path of ROUTES) {
    test(`${path} loads with no CSP violations`, async ({ page }) => {
      const violations: string[] = [];
      page.on("console", (message) => {
        if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
      });

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(violations, violations.join("\n")).toEqual([]);

      // A blocked bootstrap leaves the document standing but empty, so an
      // empty body is the symptom to assert against — not just the absence of
      // console noise.
      const text = await page.evaluate(() => document.body.innerText.trim().length);
      expect(text, "page rendered no text — scripts were probably blocked").toBeGreaterThan(0);
    });
  }

  test("script-src does not allow unsafe-inline", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"] ?? "";
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";

    expect(scriptSrc, "expected a script-src directive").toBeTruthy();
    expect(scriptSrc).toContain("nonce-");
    expect(scriptSrc).not.toContain("unsafe-inline");
  });
});

test.describe("accessibility", () => {
  /**
   * Scans run with reduced motion.
   *
   * Not a convenience: axe samples computed colour, and the sections fade in,
   * so a scan that starts before the animation settles reads whatever colour
   * the element happened to be part-way through. That produced failures at
   * 1.43:1 on a label whose settled contrast is 4.84:1 — real-looking numbers
   * for a state that exists for a few hundred milliseconds, and only on some
   * runs.
   *
   * Emulating the preference is also the more honest audit: it is a real user
   * setting the site honours, and it is the state in which the content is
   * simply present and can be measured.
   */
  test.use({ reducedMotion: "reduce" });

  test("home page has no detectable WCAG A/AA violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // The hero overlay is the one place contrast genuinely cannot be
      // evaluated: its text sits over a canvas whose backdrop is whichever
      // video frame the scroll happens to have painted.
      //
      // This used to be .disableRules(["color-contrast"]), which turned the
      // rule off for the whole document to silence one region — and hid two
      // real AA failures in the footer (a 2.87:1 button and a 3.97:1 caption)
      // until Lighthouse caught them. Excluding the region keeps the rule on
      // everywhere it can actually be judged.
      .exclude("[data-hero]")
      .analyze();

    expect(
      results.violations,
      results.violations.map((v) => `${v.id}: ${v.help}`).join("\n")
    ).toEqual([]);
  });

  test("contact section passes colour contrast", async ({ page }) => {
    await page.goto("/");
    await page.locator("#contact").scrollIntoViewIfNeeded();

    // Scoped to a section with a known solid ground, where contrast IS
    // deterministic — this is what catches the gold-on-cream problem.
    const results = await new AxeBuilder({ page }).include("#contact").analyze();

    expect(
      results.violations,
      results.violations.map((v) => `${v.id}: ${v.help}`).join("\n")
    ).toEqual([]);
  });

  test("login page has no violations", async ({ page }) => {
    await page.goto("/admin/login");
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations,
      results.violations.map((v) => `${v.id}: ${v.help}`).join("\n")
    ).toEqual([]);
  });
});
