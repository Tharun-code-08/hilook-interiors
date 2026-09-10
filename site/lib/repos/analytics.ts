import "server-only";
import crypto from "crypto";
import { and, countDistinct, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "../client";
import * as t from "../schema";

/**
 * Analytics as an append-only event log.
 *
 * The counters this replaces had two problems. Every page view did a
 * read-modify-write of the whole JSON document, so concurrent visits lost each
 * other's increments and each view re-serialised the entire store (C5). And
 * being totals, they could only answer "how many, ever" — no ranges, no
 * uniques, no dimensions (M4).
 *
 * Appending fixes both: an INSERT never reads first, and rows can be grouped.
 */

const DAY_MS = 86_400_000;

/* -------------------------------------------------------------------------
 * Visitor identity
 * ---------------------------------------------------------------------- */

/**
 * A daily-rotating, salted hash of IP + user agent.
 *
 * This is what makes "unique visitors" possible without storing anything that
 * identifies a person. The salt includes the date, so the same visitor hashes
 * differently tomorrow and yesterday's rows can't be correlated with today's;
 * no raw IP or user agent is ever written.
 *
 * Set ANALYTICS_SALT in production. Without it the salt is derived from the
 * session secret, which is stable per deployment but not guessable.
 */
function visitorHash(ip: string, userAgent: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT ?? process.env.SESSION_SECRET ?? "hilook-dev-salt";
  return crypto
    .createHash("sha256")
    .update(`${day}:${salt}:${ip}:${userAgent}`)
    .digest("base64url")
    .slice(0, 22);
}

/** Coarse device class from the user agent. Deliberately not a UA-parsing dependency. */
function deviceClass(ua: string): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s) || (/android/.test(s) && !/mobile/.test(s))) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android|blackberry|windows phone/.test(s)) return "mobile";
  return "desktop";
}

/** Browser family, coarse. Order matters — Edge and Chrome both claim Safari. */
function browserName(ua: string): string | null {
  if (!ua) return null;
  const s = ua.toLowerCase();
  if (s.includes("edg/")) return "Edge";
  if (s.includes("opr/") || s.includes("opera")) return "Opera";
  if (s.includes("firefox")) return "Firefox";
  if (s.includes("samsungbrowser")) return "Samsung Internet";
  if (s.includes("chrome") || s.includes("crios")) return "Chrome";
  if (s.includes("safari")) return "Safari";
  return "Other";
}

function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname;
    return host || null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------- */

export async function recordPageview(input: {
  path: string;
  referrer: string | null;
  ip: string;
  userAgent: string;
}): Promise<void> {
  await getDb()
    .insert(t.analyticsEvents)
    .values({
      type: "pageview",
      path: input.path,
      referrerHost: referrerHost(input.referrer),
      visitorHash: visitorHash(input.ip, input.userAgent),
      deviceClass: deviceClass(input.userAgent),
      browser: browserName(input.userAgent),
    });
}

export async function recordSectionView(input: {
  section: string;
  ip: string;
  userAgent: string;
}): Promise<void> {
  await getDb()
    .insert(t.analyticsEvents)
    .values({
      type: "section",
      section: input.section,
      visitorHash: visitorHash(input.ip, input.userAgent),
      deviceClass: deviceClass(input.userAgent),
    });
}

/* -------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------- */

/**
 * How far back the dashboard's breakdowns look.
 *
 * They used to be all-time, which made them both the slowest thing in the
 * panel and the least useful: an all-time referrer list is dominated by
 * whatever sent traffic in the first month and never moves again. Each of the
 * four walked every event the site had ever recorded, so the dashboard got
 * slower with every visitor — 724ms for the four together at 140k events. A
 * fixed window keeps the cost proportional to recent traffic instead.
 */
export const BREAKDOWN_DAYS = 30;

/** UTC midnight at the start of the breakdown window, which includes today. */
export function breakdownWindowStart(now = Date.now()): number {
  return startOfDay(now) - (BREAKDOWN_DAYS - 1) * DAY_MS;
}

export type AnalyticsSummary = {
  totalViews: number;
  viewsLast7: number;
  viewsPrior7: number;
  uniqueLast7: number;
  uniquePrior7: number;
  dailyViews: { day: string; value: number }[];
  /** Page views inside the breakdown window (see BREAKDOWN_DAYS). */
  viewsInWindow: number;
  /** This and the fields below cover the breakdown window, not all time. */
  sections: { name: string; value: number }[];
  referrers: { host: string; value: number }[];
  devices: { name: string; value: number }[];
  browsers: { name: string; value: number }[];
  reachedContact: number;
};

export async function summary(): Promise<AnalyticsSummary> {
  const db = getDb();
  const now = Date.now();
  const day0 = startOfDay(now);
  const from7 = day0 - 6 * DAY_MS;
  const from14 = day0 - 13 * DAY_MS;
  const windowStart = breakdownWindowStart(now);

  const pageviews = eq(t.analyticsEvents.type, "pageview");

  // All of these are independent, and they were awaited one after another
  // — one round trip after the next. Against a local SQLite file that is cheap
  // enough to hide; against Turso every one is a network hop, so the dashboard
  // paid ten of them in series before it could render a single number.
  //
  // Nothing here depends on anything else here, so they go out together.
  //
  // That only helps against a remote database. On a local file they queue on
  // the one connection — measured, all at once took as long as one after
  // another — so each query also has to be cheap on its own. That is what
  // BREAKDOWN_DAYS and analytics_dashboard_idx are for.
  const [
    totalRow,
    last7Row,
    prior7Row,
    uniqueLast7Row,
    uniquePrior7Row,
    dailyRows,
    sectionRows,
    referrerRows,
    deviceRows,
    browserRows,
    viewsInWindowRow,
  ] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(t.analyticsEvents)
      .where(pageviews)
      .then((r) => r[0]),

    db
      .select({ n: sql<number>`count(*)` })
      .from(t.analyticsEvents)
      .where(and(pageviews, gte(t.analyticsEvents.at, from7)))
      .then((r) => r[0]),

    db
      .select({ n: sql<number>`count(*)` })
      .from(t.analyticsEvents)
      .where(and(pageviews, gte(t.analyticsEvents.at, from14), lt(t.analyticsEvents.at, from7)))
      .then((r) => r[0]),

    db
      .select({ n: countDistinct(t.analyticsEvents.visitorHash) })
      .from(t.analyticsEvents)
      .where(
        and(pageviews, gte(t.analyticsEvents.at, from7), isNotNull(t.analyticsEvents.visitorHash))
      )
      .then((r) => r[0]),

    db
      .select({ n: countDistinct(t.analyticsEvents.visitorHash) })
      .from(t.analyticsEvents)
      .where(
        and(
          pageviews,
          gte(t.analyticsEvents.at, from14),
          lt(t.analyticsEvents.at, from7),
          isNotNull(t.analyticsEvents.visitorHash)
        )
      )
      .then((r) => r[0]),

    // Grouped by local date. SQLite date() works on seconds, hence /1000.
    db
      .select({
        day: sql<string>`date(${t.analyticsEvents.at} / 1000, 'unixepoch')`,
        value: sql<number>`count(*)`,
      })
      .from(t.analyticsEvents)
      .where(and(pageviews, gte(t.analyticsEvents.at, day0 - 13 * DAY_MS)))
      .groupBy(sql`1`),

    db
      .select({ name: t.analyticsEvents.section, value: sql<number>`count(*)` })
      .from(t.analyticsEvents)
      .where(
        and(
          eq(t.analyticsEvents.type, "section"),
          gte(t.analyticsEvents.at, windowStart),
          isNotNull(t.analyticsEvents.section)
        )
      )
      .groupBy(t.analyticsEvents.section)
      .orderBy(desc(sql`count(*)`)),

    db
      .select({ host: t.analyticsEvents.referrerHost, value: sql<number>`count(*)` })
      .from(t.analyticsEvents)
      .where(
        and(
          pageviews,
          gte(t.analyticsEvents.at, windowStart),
          isNotNull(t.analyticsEvents.referrerHost)
        )
      )
      .groupBy(t.analyticsEvents.referrerHost)
      .orderBy(desc(sql`count(*)`))
      .limit(8),

    db
      .select({ name: t.analyticsEvents.deviceClass, value: sql<number>`count(*)` })
      .from(t.analyticsEvents)
      .where(
        and(
          pageviews,
          gte(t.analyticsEvents.at, windowStart),
          isNotNull(t.analyticsEvents.deviceClass)
        )
      )
      .groupBy(t.analyticsEvents.deviceClass)
      .orderBy(desc(sql`count(*)`)),

    db
      .select({ name: t.analyticsEvents.browser, value: sql<number>`count(*)` })
      .from(t.analyticsEvents)
      .where(
        and(pageviews, gte(t.analyticsEvents.at, windowStart), isNotNull(t.analyticsEvents.browser))
      )
      .groupBy(t.analyticsEvents.browser)
      .orderBy(desc(sql`count(*)`))
      .limit(6),

    db
      .select({ n: sql<number>`count(*)` })
      .from(t.analyticsEvents)
      .where(and(pageviews, gte(t.analyticsEvents.at, windowStart)))
      .then((r) => r[0]),
  ]);

  const dailyMap = new Map(dailyRows.map((r) => [r.day, Number(r.value)]));
  const dailyViews: { day: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(day0 - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    dailyViews.push({ day: key, value: dailyMap.get(key) ?? 0 });
  }

  const sections = sectionRows.map((r) => ({ name: r.name ?? "unknown", value: Number(r.value) }));

  return {
    totalViews: Number(totalRow?.n ?? 0),
    viewsLast7: Number(last7Row?.n ?? 0),
    viewsPrior7: Number(prior7Row?.n ?? 0),
    uniqueLast7: Number(uniqueLast7Row?.n ?? 0),
    uniquePrior7: Number(uniquePrior7Row?.n ?? 0),
    dailyViews,
    viewsInWindow: Number(viewsInWindowRow?.n ?? 0),
    sections,
    referrers: referrerRows.map((r) => ({ host: r.host ?? "direct", value: Number(r.value) })),
    devices: deviceRows.map((r) => ({ name: r.name ?? "unknown", value: Number(r.value) })),
    browsers: browserRows.map((r) => ({ name: r.name ?? "Other", value: Number(r.value) })),
    reachedContact: sections.find((s) => s.name === "contact")?.value ?? 0,
  };
}

/**
 * UTC midnight, not local midnight.
 *
 * The aggregation groups rows with SQLite date(at/1000, 'unixepoch'), which
 * is UTC, and the buckets are labelled with toISOString(), which is also UTC.
 * Using local midnight for the boundaries put those two out of step by a day
 * in any timezone offset from UTC — the chart mislabelled every column and
 * showed today as empty.
 */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Drops events older than `days`.
 *
 * The log grows one row per view, so it needs a retention policy — but unlike
 * the JSON store this is periodic housekeeping, not a cost paid on every
 * write. Call from a scheduled job.
 */
export async function pruneEvents(days = 400): Promise<void> {
  await getDb()
    .delete(t.analyticsEvents)
    .where(lt(t.analyticsEvents.at, Date.now() - days * DAY_MS));
}
