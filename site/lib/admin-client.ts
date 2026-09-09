import { CSRF_COOKIE, CSRF_HEADER } from "./csrf";

/**
 * fetch() for admin mutations — attaches the CSRF token middleware requires.
 *
 * Client-side only. Reads the non-httpOnly CSRF cookie and echoes it in a
 * header; middleware compares the two. Without this every POST/PUT/PATCH/
 * DELETE from the admin panel is rejected with 403.
 */

function readCsrfToken(): string {
  if (typeof document === "undefined") return "";

  // Cookie values here are base64url (no ";" or "="-padding), so a plain
  // split is safe and avoids pulling in a parser.
  for (const part of document.cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CSRF_COOKIE) return rest.join("=");
  }
  return "";
}

/**
 * Drop-in for fetch on admin endpoints.
 *
 * Returns the Response unchanged rather than throwing on failure, so callers
 * behave exactly as they did before. That means a rejected request is still
 * silent unless the caller checks `res.ok` — finding M1, which Phase 6
 * addresses by routing every mutation through a wrapper that surfaces errors
 * as toasts and rolls back optimistic state.
 */
export function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (method !== "GET" && method !== "HEAD") {
    headers.set(CSRF_HEADER, readCsrfToken());
  }

  return fetch(input, { ...init, headers, credentials: "same-origin" });
}

/**
 * Reads the error message out of a failed admin response.
 *
 * The API returns { error, fieldErrors? } consistently now (lib/api.ts), so
 * callers get something worth showing a person rather than "failed".
 */
export async function adminError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* non-JSON response — fall through */
  }

  if (res.status === 401) return "Your session expired. Sign in again.";
  if (res.status === 403) return "You don't have permission to do that.";
  if (res.status === 429) return "Too many requests. Wait a moment and try again.";
  return `Request failed (${res.status}).`;
}
