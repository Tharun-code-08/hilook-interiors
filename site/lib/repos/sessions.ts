import "server-only";
import { and, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../client";
import { sessions } from "../schema";

/**
 * Session records — what makes a signed-in token revocable.
 *
 * Reading one of these is on the path of every authenticated request, so the
 * queries here are deliberately narrow: a primary-key lookup on verify, and a
 * throttled write for last-seen. Anything more expensive would be paid on
 * every page load in the panel.
 */

export type SessionRecord = {
  id: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  revokedAt: number | null;
  userAgent: string | null;
  ip: string | null;
};

/** Matches the token's own lifetime; the two must not drift apart. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How stale last-seen is allowed to get.
 *
 * Writing it on every request would turn each page load into a write, and the
 * value is only ever read by a human deciding whether a session looks current.
 * Five minutes is far below that threshold and costs almost nothing.
 */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export async function createSession(input: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<SessionRecord> {
  const nowMs = Date.now();
  const row = {
    id: nanoid(),
    userId: input.userId,
    createdAt: nowMs,
    lastSeenAt: nowMs,
    expiresAt: nowMs + SESSION_TTL_MS,
    revokedAt: null,
    // Trimmed: a full UA string is long, and the list only needs enough to
    // tell one device from another.
    userAgent: input.userAgent?.slice(0, 200) ?? null,
    ip: input.ip ?? null,
  };

  await getDb().insert(sessions).values(row);
  return row;
}

/** The session behind a token, or null if it cannot be used any more. */
export async function findLiveSession(id: string): Promise<SessionRecord | null> {
  const rows = await getDb().select().from(sessions).where(eq(sessions.id, id)).limit(1);
  const row = rows[0] as SessionRecord | undefined;
  if (!row) return null;
  if (row.revokedAt !== null) return null;
  if (row.expiresAt <= Date.now()) return null;
  return row;
}

/** Bumps last-seen, but only once the value is actually stale. */
export async function touchSession(row: SessionRecord): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - row.lastSeenAt < TOUCH_INTERVAL_MS) return;
  await getDb().update(sessions).set({ lastSeenAt: nowMs }).where(eq(sessions.id, row.id));
}

export async function revokeSession(id: string): Promise<void> {
  await getDb()
    .update(sessions)
    .set({ revokedAt: Date.now() })
    .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)));
}

/**
 * Ends every session for a user except, optionally, the one asking.
 *
 * `exceptId` is what makes "change my password" usable: it signs out the
 * other devices without signing the operator out of the screen they are
 * standing in front of.
 */
export async function revokeAllForUser(userId: string, exceptId?: string): Promise<number> {
  const where = exceptId
    ? and(eq(sessions.userId, userId), isNull(sessions.revokedAt), ne(sessions.id, exceptId))
    : and(eq(sessions.userId, userId), isNull(sessions.revokedAt));

  const live = await getDb().select({ id: sessions.id }).from(sessions).where(where);
  if (live.length === 0) return 0;

  await getDb().update(sessions).set({ revokedAt: Date.now() }).where(where);
  return live.length;
}

/** Live sessions for one user, newest activity first. */
export async function listLiveSessions(userId: string): Promise<SessionRecord[]> {
  const rows = await getDb()
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        sql`${sessions.expiresAt} > ${Date.now()}`
      )
    )
    .orderBy(desc(sessions.lastSeenAt));

  return rows as SessionRecord[];
}

/**
 * Drops rows that can no longer authenticate anything.
 *
 * Called opportunistically at sign-in rather than on a schedule: this app has
 * no cron, and sign-in is both infrequent and already doing writes. Expired
 * rows are harmless while they sit there — findLiveSession rejects them on
 * date — so this is housekeeping, not a security control.
 */
export async function pruneExpiredSessions(): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, Date.now()));
}
