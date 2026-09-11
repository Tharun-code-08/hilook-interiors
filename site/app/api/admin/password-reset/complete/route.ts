import { NextRequest, NextResponse } from "next/server";
import { findUserById, setPassword } from "@/lib/repos/operations";
import { clearResetTokens, consumeResetToken } from "@/lib/repos/password-resets";
import { revokeAllForUser } from "@/lib/repos/sessions";
import { checkRateLimit, clearRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { parseBody, passwordResetCompleteSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";

/**
 * Sets a new password from a reset link.
 *
 * The body is validated before the token is touched, so a password that is
 * too short sends the operator back to fix it rather than burning their link.
 */

const DEAD_LINK = "This reset link has expired or has already been used. Request a new one.";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const limit = await checkRateLimit("password-reset-complete", ip);
  if (!limit.ok) return rateLimitResponse(limit, "Too many attempts. Try again later.");

  const parsed = await parseBody(req, passwordResetCompleteSchema);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fieldErrors: parsed.fieldErrors },
      { status: 400 }
    );
  }
  const { token, newPassword } = parsed.data;

  const userId = await consumeResetToken(token);
  if (!userId) return NextResponse.json({ error: DEAD_LINK }, { status: 400 });

  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: DEAD_LINK }, { status: 400 });

  await setPassword(user.id, newPassword);

  // A reset is what someone does when they think the account is not only
  // theirs any more, so it ends every session it has — a stolen one included —
  // rather than only changing what the next sign-in needs.
  const ended = await revokeAllForUser(user.id);

  await Promise.all([
    clearResetTokens(user.id),
    // Their own mistyped attempts should not stand between them and the new
    // password.
    clearRateLimit("login", `user:${user.username.toLowerCase()}`),
  ]);

  await tryRecordAudit({
    actor: { sub: user.id, username: user.username },
    action: "password.reset",
    entity: "user",
    entityId: user.id,
    detail: ended > 0 ? `ended ${ended} session(s)` : undefined,
    ip,
  });

  return NextResponse.json({ ok: true });
}
