import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserById, setPassword } from "@/lib/repos/operations";
import { getSessionUser, signSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { parseBody, passwordChangeSchema } from "@/lib/validation";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { tryRecordAudit } from "@/lib/audit";
import { createSession, revokeAllForUser } from "@/lib/repos/sessions";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = clientIp(req);

  // This endpoint verifies the current password, which would otherwise make it
  // a way to brute-force one behind a stolen session without tripping the
  // login limiter.
  const limit = await checkRateLimit("password-change", `${ip}:${session.sub}`);
  if (!limit.ok) return rateLimitResponse(limit, "Too many attempts. Try again shortly.");

  const parsed = await parseBody(req, passwordChangeSchema);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fieldErrors: parsed.fieldErrors },
      { status: 400 }
    );
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await findUserById(session.sub);
  if (!user) {
    return NextResponse.json({ error: "Your account no longer exists." }, { status: 401 });
  }

  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return NextResponse.json(
      { error: "Current password is incorrect", fieldErrors: { currentPassword: ["Incorrect"] } },
      { status: 400 }
    );
  }

  await setPassword(user.id, newPassword);

  // A new session for this browser, then revoke every other one the account
  // has — including the one that made this request.
  //
  // Changing a password is how someone responds to thinking their credential
  // is compromised, so it has to end the attacker's access, not just change
  // what a future sign-in needs. Rotating this browser's session id too means
  // a token captured before the change is dead even on the device that made
  // it. The operator stays signed in here and nowhere else.
  const next = await createSession({
    userId: user.id,
    userAgent: req.headers.get("user-agent"),
    ip,
  });
  const endedElsewhere = await revokeAllForUser(user.id, next.id);

  await tryRecordAudit({
    actor: session,
    action: "password.change",
    entity: "user",
    entityId: user.id,
    detail: endedElsewhere > 0 ? `ended ${endedElsewhere} other session(s)` : undefined,
    ip,
  });

  const res = NextResponse.json({ ok: true, endedElsewhere });
  res.cookies.set(
    SESSION_COOKIE,
    signSession({ sub: user.id, username: user.username, role: user.role, jti: next.id }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    }
  );
  return res;
}
