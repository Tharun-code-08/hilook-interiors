/**
 * Double-submit CSRF tokens for admin mutations.
 *
 * The session cookie is SameSite=Lax, which already blocks cookies on
 * cross-site POSTs from a plain form. That covers most of the attack surface,
 * but not all of it:
 *
 *   - Lax still sends cookies on top-level GET navigations, so any state
 *     change reachable by GET stays exposed (none today — worth keeping true).
 *   - Browsers that treat SameSite inconsistently, and same-site-but-untrusted
 *     contexts such as a subdomain an attacker controls, are not covered.
 *
 * So: a random token in a readable cookie, echoed back in a header. An
 * attacker on another origin can cause the cookie to be *sent* but cannot
 * *read* it to populate the header.
 *
 * Everything here is Edge-runtime safe — no node:crypto, no next/headers — so
 * middleware.ts can enforce this centrally rather than each of the 19 admin
 * handlers remembering to. Cookie *minting* needs next/headers and lives in
 * lib/csrf-server.ts.
 */

export const CSRF_COOKIE = "hilook_csrf";
export const CSRF_HEADER = "x-hilook-csrf";

const TOKEN_BYTES = 32;

/** Web Crypto, not node:crypto — present in Node 18+ and on the Edge runtime. */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  globalThis.crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Constant-time comparison.
 *
 * node:crypto.timingSafeEqual isn't available on the Edge runtime. Comparing
 * every character and folding the differences keeps timing flat regardless of
 * where the first mismatch falls, so an attacker can't recover the token one
 * character at a time.
 *
 * Returning early on a length mismatch is fine: the token length is fixed and
 * public, so it leaks nothing.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

type CsrfCarrier = {
  cookies: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): string | null };
};

/** Verifies the echoed header matches the cookie. */
export function verifyCsrf(req: CsrfCarrier): boolean {
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length < 32) return false;

  return constantTimeEqual(cookieToken, headerToken);
}

/** Methods that change state and therefore require a token. */
const PROTECTED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requiresCsrf(method: string): boolean {
  return PROTECTED_METHODS.has(method.toUpperCase());
}
