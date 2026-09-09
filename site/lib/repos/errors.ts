import "server-only";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../client";
import { errorLog } from "../schema";

/**
 * First-party error log.
 *
 * Deliberately not Sentry. Error payloads from this app can carry a client's
 * name, email and message straight out of the contact form, and sending those
 * to a third party is a decision that should be made on purpose rather than
 * inherited from a default. Everything here stays in the same database as the
 * rest of the site.
 *
 * The rules that keep it useful rather than merely large:
 *
 *   - Group by fingerprint. One bug in a loop is one row with a count, not ten
 *     thousand rows burying everything else.
 *   - Never record a request body, and never record headers. A stack trace and
 *     a path say what broke; a body says who it broke for.
 *   - Recording must never throw. An error while recording an error would turn
 *     a handled failure into an unhandled one.
 */

export type ErrorRecord = {
  fingerprint: string;
  firstSeenAt: number;
  lastSeenAt: number;
  count: number;
  source: "server" | "client";
  message: string;
  stack: string | null;
  path: string | null;
  method: string | null;
  actorId: string | null;
  userAgent: string | null;
  resolvedAt: number | null;
};

/** Long enough to identify a failure; short enough not to store a novel. */
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

/**
 * Message plus the first stack frame.
 *
 * Not the whole trace: the frames above the throw differ between requests, so
 * hashing all of them would give every occurrence its own row and defeat the
 * grouping. The first frame is the line that actually failed.
 *
 * FNV-1a rather than node:crypto, and not for speed. This module is reached
 * from instrumentation.ts, which Next loads into every runtime it starts — and
 * webpack follows the import while building the Edge bundle even behind a
 * NEXT_RUNTIME check, failing on "Reading from node:crypto is not handled by
 * plugins". A fingerprint is a grouping key, not a security boundary: it has to
 * survive accident, not an adversary, and two distinct bugs colliding would
 * only file them together.
 */
function fingerprintOf(message: string, stack: string | null, path: string | null): string {
  const firstFrame =
    stack
      ?.split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("at ")) ?? "";

  const input = `${message}\n${firstFrame}\n${path ?? ""}`;

  // Two independently seeded passes, concatenated: one 32-bit hash collides
  // too readily across a long-lived table.
  const pass = (seed: number) => {
    let h = seed;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  };

  return pass(0x811c9dc5) + pass(0x7fffffff);
}

export async function recordError(input: {
  error: unknown;
  source?: "server" | "client";
  path?: string | null;
  method?: string | null;
  actorId?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const err = input.error;
    const message = (
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error"
    ).slice(0, MAX_MESSAGE);

    const stack = err instanceof Error && err.stack ? err.stack.slice(0, MAX_STACK) : null;
    const path = input.path ?? null;
    const fingerprint = fingerprintOf(message, stack, path);
    const nowMs = Date.now();

    // One statement, so two requests failing at once cannot read-modify-write
    // over each other's count.
    await getDb()
      .insert(errorLog)
      .values({
        fingerprint,
        firstSeenAt: nowMs,
        lastSeenAt: nowMs,
        count: 1,
        source: input.source ?? "server",
        message,
        stack,
        path,
        method: input.method ?? null,
        actorId: input.actorId ?? null,
        userAgent: input.userAgent?.slice(0, 200) ?? null,
        resolvedAt: null,
      })
      .onConflictDoUpdate({
        target: errorLog.fingerprint,
        set: {
          lastSeenAt: nowMs,
          count: sql`${errorLog.count} + 1`,
          // A recurrence after someone marked it resolved is news; reopen it.
          resolvedAt: null,
        },
      });
  } catch (recordingFailure) {
    // Swallowed on purpose. This runs on a path that is already handling a
    // failure, and throwing here would replace a logged error with an
    // unhandled one.
    console.error("[errors] could not record an error:", recordingFailure);
  }
}

export async function listErrors(options?: {
  includeResolved?: boolean;
  limit?: number;
}): Promise<ErrorRecord[]> {
  const limit = options?.limit ?? 50;

  const rows = options?.includeResolved
    ? await getDb().select().from(errorLog).orderBy(desc(errorLog.lastSeenAt)).limit(limit)
    : await getDb()
        .select()
        .from(errorLog)
        .where(isNull(errorLog.resolvedAt))
        .orderBy(desc(errorLog.lastSeenAt))
        .limit(limit);

  return rows as ErrorRecord[];
}

export async function countUnresolvedErrors(): Promise<number> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(errorLog)
    .where(isNull(errorLog.resolvedAt));

  return Number(rows[0]?.n ?? 0);
}

export async function resolveError(fingerprint: string): Promise<void> {
  await getDb()
    .update(errorLog)
    .set({ resolvedAt: Date.now() })
    .where(and(eq(errorLog.fingerprint, fingerprint), isNull(errorLog.resolvedAt)));
}

/** Drops resolved rows that stopped happening a while ago. */
export async function pruneResolvedErrors(olderThanMs = 30 * 24 * 60 * 60 * 1000): Promise<void> {
  await getDb()
    .delete(errorLog)
    .where(
      and(
        sql`${errorLog.resolvedAt} is not null`,
        lt(errorLog.lastSeenAt, Date.now() - olderThanMs)
      )
    );
}
