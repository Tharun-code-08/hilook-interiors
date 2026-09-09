import "server-only";
import { cookies } from "next/headers";
import { CSRF_COOKIE, generateCsrfToken } from "./csrf";

/**
 * Cookie minting for the CSRF token. Split from lib/csrf.ts because
 * next/headers is not available in middleware, and middleware is what
 * enforces the token.
 */

/**
 * Reads the current token, minting one if absent. Called from the admin
 * layout so every authenticated page load guarantees a token exists before
 * any client code needs to echo it.
 *
 * Deliberately NOT httpOnly: the client has to read it to send it back. That
 * is safe because the token is not a credential on its own — it proves only
 * that the caller can read cookies for this origin, which is exactly the
 * property being tested.
 */
export async function ensureCsrfToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CSRF_COOKIE)?.value;
  if (existing && existing.length >= 32) return existing;

  const token = generateCsrfToken();
  store.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return token;
}
