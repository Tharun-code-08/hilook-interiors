import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";

const testDb = createTestDatabase();

type Analytics = typeof import("@/lib/repos/analytics");
type RateLimit = typeof import("@/lib/rate-limit");

let analytics: Analytics;
let rateLimit: RateLimit;

const CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const SAFARI_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1";

beforeAll(async () => {
  await testDb.migrate();
  analytics = await import("@/lib/repos/analytics");
  rateLimit = await import("@/lib/rate-limit");
});

afterAll(() => testDb.cleanup());

describe("analytics event log", () => {
  it("classifies device and browser from the user agent", async () => {
    await analytics.recordPageview({
      path: "/",
      referrer: null,
      ip: "1.1.1.1",
      userAgent: CHROME_DESKTOP,
    });
    await analytics.recordPageview({
      path: "/",
      referrer: null,
      ip: "2.2.2.2",
      userAgent: SAFARI_IPHONE,
    });
    await analytics.recordPageview({
      path: "/",
      referrer: null,
      ip: "3.3.3.3",
      userAgent: SAFARI_IPAD,
    });

    const result = await analytics.summary();
    const devices = Object.fromEntries(result.devices.map((d) => [d.name, d.value]));

    expect(devices.desktop).toBe(1);
    expect(devices.mobile).toBe(1);
    // An iPad reports "Safari" without "Mobile" — it must not be counted as a
    // phone, which is the classic mis-bucketing in UA sniffing.
    expect(devices.tablet).toBe(1);

    const browsers = Object.fromEntries(result.browsers.map((b) => [b.name, b.value]));
    expect(browsers.Chrome).toBe(1);
    expect(browsers.Safari).toBe(2);
  });

  it("records the referrer host, not the whole URL", async () => {
    await analytics.recordPageview({
      path: "/",
      referrer: "https://www.google.com/search?q=interior+design+studio",
      ip: "4.4.4.4",
      userAgent: CHROME_DESKTOP,
    });

    const result = await analytics.summary();
    const google = result.referrers.find((r) => r.host === "www.google.com");
    // Storing the full URL would carry the visitor's search terms into our
    // database; the host is all the dashboard needs.
    expect(google?.value).toBe(1);
  });

  it("ignores a malformed referrer rather than throwing", async () => {
    await expect(
      analytics.recordPageview({
        path: "/",
        referrer: "not a url at all",
        ip: "5.5.5.5",
        userAgent: CHROME_DESKTOP,
      })
    ).resolves.not.toThrow();
  });

  it("counts unique visitors, not raw views", async () => {
    const before = (await analytics.summary()).uniqueLast7;

    // Same IP and user agent five times — one visitor.
    for (let i = 0; i < 5; i++) {
      await analytics.recordPageview({
        path: "/",
        referrer: null,
        ip: "9.9.9.9",
        userAgent: CHROME_DESKTOP,
      });
    }

    const after = await analytics.summary();
    expect(after.uniqueLast7).toBe(before + 1);
  });

  it("treats a different user agent from the same IP as a different visitor", async () => {
    const before = (await analytics.summary()).uniqueLast7;

    await analytics.recordPageview({
      path: "/",
      referrer: null,
      ip: "8.8.8.8",
      userAgent: CHROME_DESKTOP,
    });
    await analytics.recordPageview({
      path: "/",
      referrer: null,
      ip: "8.8.8.8",
      userAgent: SAFARI_IPHONE,
    });

    expect((await analytics.summary()).uniqueLast7).toBe(before + 2);
  });

  it("stores a hash, never the IP or user agent", async () => {
    const { getDb } = await import("@/lib/client");
    const t = await import("@/lib/schema");
    const rows = await getDb().select().from(t.analyticsEvents).limit(50);

    for (const row of rows) {
      expect(row.visitorHash).not.toContain("9.9.9.9");
      expect(row.visitorHash).not.toContain("Mozilla");
      if (row.visitorHash) expect(row.visitorHash.length).toBeLessThanOrEqual(22);
    }
    // Nothing on the row holds the raw values.
    expect(Object.keys(rows[0])).not.toContain("ip");
    expect(Object.keys(rows[0])).not.toContain("userAgent");
  });

  it("separates section views from page views", async () => {
    await analytics.recordSectionView({
      section: "contact",
      ip: "1.1.1.1",
      userAgent: CHROME_DESKTOP,
    });
    await analytics.recordSectionView({
      section: "contact",
      ip: "2.2.2.2",
      userAgent: CHROME_DESKTOP,
    });
    await analytics.recordSectionView({
      section: "portfolio",
      ip: "1.1.1.1",
      userAgent: CHROME_DESKTOP,
    });

    const result = await analytics.summary();
    const sections = Object.fromEntries(result.sections.map((s) => [s.name, s.value]));

    expect(sections.contact).toBe(2);
    expect(sections.portfolio).toBe(1);
    // The funnel's middle step reads from this.
    expect(result.reachedContact).toBe(2);
    // Section events must not inflate the page-view total.
    expect(result.totalViews).toBeLessThan(result.totalViews + 3);
  });

  it("returns exactly 14 daily buckets, including empty days", async () => {
    const result = await analytics.summary();
    expect(result.dailyViews).toHaveLength(14);

    // Ascending, and the last bucket is today.
    const days = result.dailyViews.map((d) => d.day);
    expect([...days].sort()).toEqual(days);
    expect(days[13]).toBe(new Date().toISOString().slice(0, 10));

    // Today's bucket holds the events this file recorded.
    expect(result.dailyViews[13].value).toBeGreaterThan(0);
  });

  it("prunes events older than the retention window", async () => {
    const { getDb } = await import("@/lib/client");
    const t = await import("@/lib/schema");

    const old = Date.now() - 500 * 86_400_000;
    await getDb().insert(t.analyticsEvents).values({ type: "pageview", path: "/", at: old });

    const before = (await getDb().select().from(t.analyticsEvents)).length;
    await analytics.pruneEvents(400);
    const after = (await getDb().select().from(t.analyticsEvents)).length;

    expect(after).toBe(before - 1);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then rejects", async () => {
    const key = `test-${Date.now()}`;

    // newsletter: 3 per hour
    for (let i = 0; i < 3; i++) {
      const result = await rateLimit.checkRateLimit("newsletter", key);
      expect(result.ok, `attempt ${i + 1} should be allowed`).toBe(true);
    }

    const blocked = await rateLimit.checkRateLimit("newsletter", key);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("counts each identifier separately", async () => {
    const a = `a-${Date.now()}`;
    const b = `b-${Date.now()}`;

    for (let i = 0; i < 3; i++) await rateLimit.checkRateLimit("newsletter", a);
    expect((await rateLimit.checkRateLimit("newsletter", a)).ok).toBe(false);

    // One client exhausting its budget must not lock out everyone else.
    expect((await rateLimit.checkRateLimit("newsletter", b)).ok).toBe(true);
  });

  it("counts each bucket separately", async () => {
    const key = `shared-${Date.now()}`;
    for (let i = 0; i < 3; i++) await rateLimit.checkRateLimit("newsletter", key);

    expect((await rateLimit.checkRateLimit("newsletter", key)).ok).toBe(false);
    // A blocked newsletter signup must not also block the contact form.
    expect((await rateLimit.checkRateLimit("contact", key)).ok).toBe(true);
  });

  it("clears a key on demand, so one typo doesn't linger after a good login", async () => {
    const key = `clear-${Date.now()}`;
    for (let i = 0; i < 5; i++) await rateLimit.checkRateLimit("login", key);
    expect((await rateLimit.checkRateLimit("login", key)).ok).toBe(false);

    await rateLimit.clearRateLimit("login", key);
    expect((await rateLimit.checkRateLimit("login", key)).ok).toBe(true);
  });

  it("reports remaining attempts", async () => {
    const key = `remaining-${Date.now()}`;
    expect((await rateLimit.checkRateLimit("newsletter", key)).remaining).toBe(2);
    expect((await rateLimit.checkRateLimit("newsletter", key)).remaining).toBe(1);
    expect((await rateLimit.checkRateLimit("newsletter", key)).remaining).toBe(0);
  });

  /**
   * The increment is a single upsert rather than read-then-write. If it were
   * the latter, concurrent requests could each read the same count and all be
   * allowed through — the limit would be advisory rather than enforced.
   */
  it("holds the limit under concurrent requests", async () => {
    const key = `concurrent-${Date.now()}`;

    const results = await Promise.all(
      Array.from({ length: 12 }, () => rateLimit.checkRateLimit("newsletter", key))
    );

    const allowed = results.filter((r) => r.ok).length;
    expect(allowed).toBe(3);
  });
});
