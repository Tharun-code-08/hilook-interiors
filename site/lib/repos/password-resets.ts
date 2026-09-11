import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../client";
import * as t from "../schema";

/**
 * One-time password reset links.
 *
 * Only a SHA-256 of each token is stored. The token itself exists in the email
 * and in the link the operator opens, so a copy of the database — a backup, a
 * leaked export — is not a set of working keys to the panel. A plain hash is
 * enough here, unlike for passwords: the token is 256 random bits, so there is
 * nothing to guess and nothing a slow hash would protect.
 */

export const RESET_TOKEN_TTL_MS = 30 * 60_000;

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * A new link for an account, replacing any it already had.
 *
 * Only the newest link works. Asking twice should not leave two live keys to
 * the account sitting in two emails.
 */
export async function issueResetToken(
  userId: string,
  requestedIp: string | null
): Promise<{ token: string; expiresAt: number }> {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = now + RESET_TOKEN_TTL_MS;

  await db.batch([
    db.delete(t.passwordResetTokens).where(eq(t.passwordResetTokens.userId, userId)),
    db.insert(t.passwordResetTokens).values({
      id: nanoid(),
      userId,
      tokenHash: digest(token),
      expiresAt,
      createdAt: now,
      requestedIp,
    }),
  ]);

  return { token, expiresAt };
}

/**
 * The account a link belongs to, if the link is still usable.
 *
 * Looking does not use it up. Mail scanners and link previews open links
 * before people do, and a link that died on first view would be dead before
 * its owner ever clicked it.
 */
export async function peekResetToken(
  token: string
): Promise<{ userId: string; expiresAt: number } | null> {
  if (!token) return null;
  const [row] = await getDb()
    .select({
      userId: t.passwordResetTokens.userId,
      expiresAt: t.passwordResetTokens.expiresAt,
    })
    .from(t.passwordResetTokens)
    .where(
      and(
        eq(t.passwordResetTokens.tokenHash, digest(token)),
        isNull(t.passwordResetTokens.usedAt),
        gt(t.passwordResetTokens.expiresAt, Date.now())
      )
    );
  return row ?? null;
}

/**
 * Uses a link up and returns its account — the check and the claim in one
 * statement, so two requests carrying the same token cannot both succeed.
 */
export async function consumeResetToken(token: string): Promise<string | null> {
  if (!token) return null;
  const now = Date.now();
  const [row] = await getDb()
    .update(t.passwordResetTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(t.passwordResetTokens.tokenHash, digest(token)),
        isNull(t.passwordResetTokens.usedAt),
        gt(t.passwordResetTokens.expiresAt, now)
      )
    )
    .returning({ userId: t.passwordResetTokens.userId });
  return row?.userId ?? null;
}

/** Every outstanding link for an account: after a reset, an email change, or deletion. */
export async function clearResetTokens(userId: string): Promise<void> {
  await getDb().delete(t.passwordResetTokens).where(eq(t.passwordResetTokens.userId, userId));
}
