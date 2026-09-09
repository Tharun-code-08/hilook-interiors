import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByUsername, recordLogin } from "@/lib/repos/operations";
import { signSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { CSRF_COOKIE, generateCsrfToken } from "@/lib/csrf";
import { clientIp } from "@/lib/request";
import { checkRateLimit, clearRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { loginSchema, parseBody } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";

/**
 * A hash of a value nobody will submit, so verifying an unknown username
 * costs the same time as a known one. Without it, "no such user" returns
 * markedly faster and the endpoint becomes a username oracle.
 */
const DUMMY_HASH = bcrypt.hashSync("hilook-timing-equaliser", 12);

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const parsed = await parseBody(req, loginSchema);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { username, password } = parsed.data;

  // Scoped to IP *and* username: spraying one username from many addresses is
  // caught by the username key, and one address trying many usernames by the
  // IP key. Neither can lock out a legitimate operator via the other.
  const ipKey = ip;
  const userKey = `user:${username.toLowerCase()}`;

  const [ipLimit, userLimit] = await Promise.all([
    checkRateLimit("login", ipKey),
    checkRateLimit("login", userKey),
  ]);

  if (!ipLimit.ok || !userLimit.ok) {
    return rateLimitResponse(
      !ipLimit.ok ? ipLimit : userLimit,
      "Too many failed sign-in attempts. Try again in a few minutes."
    );
  }

  const user = await findUserByUsername(username);
  const passwordMatches = bcrypt.compareSync(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    await tryRecordAudit({
      actor: { sub: "anonymous", username },
      action: "login.failed",
      entity: "session",
      ip,
    });
    // One message for both cases, so the body can't reveal whether the
    // username exists.
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await Promise.all([clearRateLimit("login", ipKey), clearRateLimit("login", userKey)]);
  await recordLogin(user.id);

  await tryRecordAudit({
    actor: { sub: user.id, username: user.username },
    action: "login",
    entity: "session",
    ip,
  });

  const res = NextResponse.json({
    ok: true,
    mustChangePassword: user.mustChangePassword,
  });

  const cookieOptions = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  res.cookies.set(
    SESSION_COOKIE,
    signSession({ sub: user.id, username: user.username, role: user.role }),
    { ...cookieOptions, httpOnly: true }
  );

  // Minted alongside the session so the first admin mutation already has a
  // token to echo. Not httpOnly — the client has to read it to send it back.
  res.cookies.set(CSRF_COOKIE, generateCsrfToken(), { ...cookieOptions, httpOnly: false });

  return res;
}
