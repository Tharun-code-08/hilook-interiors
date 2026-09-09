/**
 * The session cookie's name, on its own.
 *
 * lib/auth.ts pulls in jsonwebtoken and node:fs, neither of which the Edge
 * runtime provides — so middleware cannot import from there just to learn a
 * string. Keeping the constant in a dependency-free module lets both sides
 * share one definition instead of duplicating the literal.
 */
export const SESSION_COOKIE = "hilook_session";
