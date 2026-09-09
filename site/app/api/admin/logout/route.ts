import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { CSRF_COOKIE } from "@/lib/csrf";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // Clear both: leaving the CSRF cookie behind would hand the next visitor on
  // a shared machine a token already paired with nothing, which is harmless
  // but confusing to debug.
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(CSRF_COOKIE, "", { path: "/", maxAge: 0 });

  return res;
}
