import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { CSRF_COOKIE } from "@/lib/csrf";
import { revokeSession } from "@/lib/repos/sessions";

export async function POST() {
  // Revoke before clearing the cookie. Clearing it only stops *this* browser
  // sending the token; anyone holding a copy could carry on using it for the
  // rest of its seven days, which is what signing out is supposed to prevent.
  const session = await getSessionUser();
  if (session?.jti) await revokeSession(session.jti);

  const res = NextResponse.json({ ok: true });

  // Clear both: leaving the CSRF cookie behind would hand the next visitor on
  // a shared machine a token already paired with nothing, which is harmless
  // but confusing to debug.
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(CSRF_COOKIE, "", { path: "/", maxAge: 0 });

  return res;
}
