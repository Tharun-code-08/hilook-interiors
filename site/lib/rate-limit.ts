import "server-only";
import { eq, lt, sql } from "drizzle-orm";
import { getDb } from "./client";
import * as t from "./schema";

/**
 * Shared fixed-window rate limiter, backed by SQL.
 *
 * Two rewrites deep now. It started as a module-level Map (reset on restart,
 * not shared across instances, never evicted), then moved to the JSON store,
 * and now sits on rows — which is what finally makes it correct under
 * concurrency: the increment is a single atomic UPDATE rather than a
 * read-modify-write, so simultaneous requests can't both read "4 of 5" and
 * both be allowed through.
 */

export type Bucket = "login" | "contact" | "newsletter" | "analytics" | "password-change";

type Policy = { limit: number; windowMs: number };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const POLICIES: Record<Bucket, Policy> = {
  // Credential stuffing. Callers scope this per-IP *and* per-username so one
  // attacker can't lock a legitimate operator out from another address.
  login: { limit: 5, windowMs: 10 * MINUTE },
  contact: { limit: 5, windowMs: HOUR },
  newsletter: { limit: 3, windowMs: HOUR },
  // Section beacons fire once per section per page view; seven sections plus
  // reloads. Generous for a person, still caps what an attacker can insert.
  analytics: { limit: 60, windowMs: HOUR },
  "password-change": { limit: 10, windowMs: HOUR },
};

export type RateLimitResult = { ok: boolean; remaining: number; retryAfter: number };

export async function checkRateLimit(bucket: Bucket, identifier: string): Promise<RateLimitResult> {
  const policy = POLICIES[bucket];
  const key = `${bucket}:${identifier}`;
  const now = Date.now();
  const db = getDb();

  // One statement that either starts a fresh window or increments the live
  // one, and RETURNS the resulting count.
  //
  // The returning clause is what makes this exact under concurrency. An
  // earlier version incremented and then issued a separate SELECT — so with
  // twelve simultaneous requests every SELECT ran after all twelve increments
  // and saw the final total, rejecting all of them instead of admitting the
  // first three. Each caller now reads the value its own increment produced.
  const [row] = await db
    .insert(t.rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: t.rateLimits.key,
      set: {
        count: sql`CASE
          WHEN ${now} - ${t.rateLimits.windowStart} >= ${policy.windowMs} THEN 1
          ELSE ${t.rateLimits.count} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${now} - ${t.rateLimits.windowStart} >= ${policy.windowMs} THEN ${now}
          ELSE ${t.rateLimits.windowStart}
        END`,
      },
    })
    .returning({ count: t.rateLimits.count, windowStart: t.rateLimits.windowStart });

  if (!row) return { ok: true, remaining: policy.limit - 1, retryAfter: 0 };

  const elapsed = now - row.windowStart;
  const retryAfter = Math.max(1, Math.ceil((policy.windowMs - elapsed) / 1000));

  if (row.count > policy.limit) {
    return { ok: false, remaining: 0, retryAfter };
  }

  return { ok: true, remaining: Math.max(0, policy.limit - row.count), retryAfter };
}

/** Clears a key early — called after a successful login so one typo doesn't linger. */
export async function clearRateLimit(bucket: Bucket, identifier: string): Promise<void> {
  await getDb()
    .delete(t.rateLimits)
    .where(eq(t.rateLimits.key, `${bucket}:${identifier}`));
}

/** Housekeeping: drop windows that closed long ago. */
export async function pruneRateLimits(): Promise<void> {
  const longest = Math.max(...Object.values(POLICIES).map((p) => p.windowMs));
  await getDb()
    .delete(t.rateLimits)
    .where(lt(t.rateLimits.windowStart, Date.now() - longest * 2));
}

/** Standard 429 body + Retry-After. */
export function rateLimitResponse(result: RateLimitResult, message: string) {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(Math.max(1, result.retryAfter)) } }
  );
}
