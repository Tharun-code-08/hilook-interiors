import "server-only";
import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { getDb } from "../client";
import * as t from "../schema";
import type { AdminUser, AuditEntry, MediaItem, PublicAdminUser, Submission } from "../types";
import { publicUrlFor } from "../storage";

const iso = (ms: number) => new Date(ms).toISOString();

/* -------------------------------------------------------------------------
 * Submissions
 * ---------------------------------------------------------------------- */

function toSubmission(r: typeof t.submissions.$inferSelect): Submission {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    message: r.message,
    read: r.read,
    responded: r.responded,
    createdAt: iso(r.createdAt),
  };
}

/**
 * Most recent enquiries first, capped.
 *
 * This was unbounded — every row, every render. The inbox is the one table
 * that only ever grows, so an admin screen that renders all of it gets slower
 * every month and has no ceiling. The CSV export still covers everything;
 * this is what the screen shows.
 */
export async function listSubmissions(limit = 100): Promise<Submission[]> {
  const rows = await getDb()
    .select()
    .from(t.submissions)
    .orderBy(desc(t.submissions.createdAt))
    .limit(limit);
  return rows.map(toSubmission);
}

export async function countSubmissions(): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(t.submissions);
  return Number(row?.n ?? 0);
}

export async function createSubmission(input: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<Submission> {
  const db = getDb();
  const id = nanoid();
  await db.insert(t.submissions).values({ id, ...input });
  const [row] = await db.select().from(t.submissions).where(eq(t.submissions.id, id));
  return toSubmission(row);
}

export async function updateSubmission(
  id: string,
  patch: { read?: boolean; responded?: boolean }
): Promise<Submission | null> {
  const db = getDb();
  const values: Record<string, unknown> = {};
  if (patch.read !== undefined) values.read = patch.read;
  if (patch.responded !== undefined) values.responded = patch.responded;
  if (Object.keys(values).length > 0) {
    await db.update(t.submissions).set(values).where(eq(t.submissions.id, id));
  }
  const [row] = await db.select().from(t.submissions).where(eq(t.submissions.id, id));
  return row ? toSubmission(row) : null;
}

export async function deleteSubmission(id: string): Promise<Submission | null> {
  const db = getDb();
  const [row] = await db.select().from(t.submissions).where(eq(t.submissions.id, id));
  if (!row) return null;
  await db.delete(t.submissions).where(eq(t.submissions.id, id));
  return toSubmission(row);
}

export async function submissionStats(): Promise<{ total: number; unread: number }> {
  const db = getDb();
  const [totalRow] = await db.select({ n: count() }).from(t.submissions);
  const [unreadRow] = await db
    .select({ n: count() })
    .from(t.submissions)
    .where(eq(t.submissions.read, false));
  return { total: totalRow?.n ?? 0, unread: unreadRow?.n ?? 0 };
}

/** Counts enquiries in [from, to) — used for the dashboard's period deltas. */
export async function submissionsBetween(from: number, to: number): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(t.submissions)
    .where(and(gte(t.submissions.createdAt, from), lt(t.submissions.createdAt, to)));
  return row?.n ?? 0;
}

/* -------------------------------------------------------------------------
 * Newsletter
 * ---------------------------------------------------------------------- */

export async function subscribe(email: string): Promise<void> {
  // Lower-cased, and an upsert rather than select-then-insert: two concurrent
  // signups for the same address can't race into a duplicate-key error.
  await getDb()
    .insert(t.newsletterSubscribers)
    .values({ email: email.toLowerCase() })
    .onConflictDoNothing();
}

export async function subscriberCount(): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(t.newsletterSubscribers);
  return row?.n ?? 0;
}

/* -------------------------------------------------------------------------
 * Media
 * ---------------------------------------------------------------------- */

function toMedia(r: typeof t.media.$inferSelect): MediaItem {
  return {
    id: r.id,
    filename: r.filename,
    // The URL is derived from the storage key by the active driver, so moving
    // from local disk to a bucket needs no change to stored data.
    url: publicUrlFor(r.storageKey),
    kind: r.contentType.startsWith("image/") ? "image" : "other",
    uploadedAt: iso(r.uploadedAt),
    width: r.width,
    height: r.height,
    bytes: r.bytes,
    alt: r.alt,
  };
}

/** Most recently uploaded first, capped for the same reason as the inbox. */
export async function listMedia(limit = 120): Promise<MediaItem[]> {
  const rows = await getDb().select().from(t.media).orderBy(desc(t.media.uploadedAt)).limit(limit);
  return rows.map(toMedia);
}

export async function createMedia(input: {
  id: string;
  filename: string;
  storageKey: string;
  contentType: string;
  width: number;
  height: number;
  bytes: number;
}): Promise<MediaItem> {
  const db = getDb();
  await db.insert(t.media).values(input);
  const [row] = await db.select().from(t.media).where(eq(t.media.id, input.id));
  return toMedia(row);
}

export async function getMedia(id: string): Promise<(MediaItem & { storageKey: string }) | null> {
  const [row] = await getDb().select().from(t.media).where(eq(t.media.id, id));
  return row ? { ...toMedia(row), storageKey: row.storageKey } : null;
}

export async function deleteMedia(
  id: string
): Promise<(MediaItem & { storageKey: string }) | null> {
  const db = getDb();
  const [row] = await db.select().from(t.media).where(eq(t.media.id, id));
  if (!row) return null;
  await db.delete(t.media).where(eq(t.media.id, id));
  return { ...toMedia(row), storageKey: row.storageKey };
}

/* -------------------------------------------------------------------------
 * Users
 * ---------------------------------------------------------------------- */

const BCRYPT_ROUNDS = 12;

/**
 * Detects a unique-constraint violation through Drizzle's error wrapping.
 *
 * Drizzle re-throws driver errors wrapped in its own "Failed query: ..."
 * Error, with the original on `cause`. A naive `String(error).includes(...)`
 * only sees the wrapper's message — so duplicate usernames escaped detection
 * and surfaced as a 500 instead of a 409. Walk the chain and check both the
 * structured code and the message.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as { code?: string; message?: string; cause?: unknown };

    if (typeof candidate.code === "string" && candidate.code.includes("SQLITE_CONSTRAINT")) {
      return true;
    }
    if (
      typeof candidate.message === "string" &&
      /UNIQUE constraint failed/i.test(candidate.message)
    ) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}

function toUser(r: typeof t.users.$inferSelect): AdminUser {
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.passwordHash,
    role: r.role,
    mustChangePassword: r.mustChangePassword,
    passwordChangedAt: r.passwordChangedAt ? iso(r.passwordChangedAt) : null,
    lastLoginAt: r.lastLoginAt ? iso(r.lastLoginAt) : null,
    createdAt: iso(r.createdAt),
  };
}

/** Never returns passwordHash — this is what the API serves. */
export async function listUsers(): Promise<PublicAdminUser[]> {
  const rows = await getDb().select().from(t.users).orderBy(asc(t.users.createdAt));
  return rows.map((r) => {
    const { passwordHash: _omit, ...rest } = toUser(r);
    return rest;
  });
}

export async function findUserByUsername(username: string): Promise<AdminUser | null> {
  const [row] = await getDb()
    .select()
    .from(t.users)
    .where(sql`lower(${t.users.username}) = ${username.toLowerCase()}`);
  return row ? toUser(row) : null;
}

export async function findUserById(id: string): Promise<AdminUser | null> {
  const [row] = await getDb().select().from(t.users).where(eq(t.users.id, id));
  return row ? toUser(row) : null;
}

export async function createUser(input: {
  username: string;
  password: string;
  role: "owner" | "editor";
}): Promise<{ ok: true; user: PublicAdminUser } | { ok: false; reason: "duplicate" }> {
  const db = getDb();
  const id = nanoid();

  try {
    await db.insert(t.users).values({
      id,
      username: input.username,
      passwordHash: bcrypt.hashSync(input.password, BCRYPT_ROUNDS),
      role: input.role,
      mustChangePassword: true,
    });
  } catch (error) {
    // The case-insensitive unique index is the authority on duplicates, not a
    // prior SELECT — checking first leaves a window where two concurrent
    // creates both pass the check.
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    throw error;
  }

  const [row] = await db.select().from(t.users).where(eq(t.users.id, id));
  const { passwordHash: _omit, ...rest } = toUser(row);
  return { ok: true, user: rest };
}

export async function setPassword(id: string, password: string): Promise<void> {
  await getDb()
    .update(t.users)
    .set({
      passwordHash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
      mustChangePassword: false,
      passwordChangedAt: Date.now(),
    })
    .where(eq(t.users.id, id));
}

export async function recordLogin(id: string): Promise<void> {
  await getDb().update(t.users).set({ lastLoginAt: Date.now() }).where(eq(t.users.id, id));
}

export async function countOwners(excludeId?: string): Promise<number> {
  const rows = await getDb()
    .select({ id: t.users.id })
    .from(t.users)
    .where(eq(t.users.role, "owner"));
  return rows.filter((r) => r.id !== excludeId).length;
}

export async function deleteUser(id: string): Promise<AdminUser | null> {
  const db = getDb();
  const [row] = await db.select().from(t.users).where(eq(t.users.id, id));
  if (!row) return null;
  await db.delete(t.users).where(eq(t.users.id, id));
  return toUser(row);
}

/* -------------------------------------------------------------------------
 * Audit log
 * ---------------------------------------------------------------------- */

export async function recordAudit(entry: {
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string | null;
  ip?: string | null;
}): Promise<void> {
  await getDb()
    .insert(t.auditLog)
    .values({
      id: nanoid(),
      actorId: entry.actorId,
      actorName: entry.actorName,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      detail: entry.detail ? entry.detail.slice(0, 500) : null,
      ip: entry.ip ?? null,
    });
}

export async function recentAudit(limit = 20): Promise<AuditEntry[]> {
  const rows = await getDb().select().from(t.auditLog).orderBy(desc(t.auditLog.at)).limit(limit);

  return rows.map((r) => ({
    id: r.id,
    at: iso(r.at),
    actorId: r.actorId,
    actorName: r.actorName,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    detail: r.detail,
    ip: r.ip,
  }));
}

/**
 * Trims the log to its most recent `keep` entries.
 *
 * Unbounded it would grow forever; unlike the JSON store, though, that is now
 * a housekeeping concern rather than a per-write cost, so it runs occasionally
 * rather than on every append.
 */
export async function pruneAudit(keep = 5000): Promise<void> {
  await getDb().run(sql`
    DELETE FROM ${t.auditLog}
    WHERE id NOT IN (
      SELECT id FROM ${t.auditLog} ORDER BY at DESC LIMIT ${keep}
    )
  `);
}
