import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { requiresCsrf, verifyCsrf } from "@/lib/csrf";

/** The ways in: signing in, asking for a reset link, and using one. */
const PUBLIC_ADMIN_PAGES = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
]);

const AUTH_ENDPOINTS = new Set([
  "/api/admin/login",
  "/api/admin/logout",
  "/api/admin/password-reset/request",
  "/api/admin/password-reset/complete",
]);

/**
 * Edge middleware: security headers on every response, plus two guards on the
 * admin surface.
 *
 * What this is NOT: authentication. It checks only that a session cookie is
 * *present*, never that it is valid — verifying the JWT needs node:crypto,
 * which the Edge runtime doesn't provide. Real verification stays in
 * app/admin/(dashboard)/layout.tsx and in each route handler. This is a cheap
 * outer gate that turns "unauthenticated request reaches your handler" into
 * "unauthenticated request is redirected at the edge", and centralises CSRF
 * so all 19 handlers can't individually forget it.
 */

/**
 * A fresh nonce per response.
 *
 * Edge has Web Crypto but not node:crypto, so this is getRandomValues rather
 * than randomBytes. 16 bytes is the length the CSP spec recommends.
 */
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function cspFor(nonce: string): string {
  return [
    "default-src 'self'",

    // Nonce instead of 'unsafe-inline'.
    //
    // 'unsafe-inline' on script-src is the directive that matters: with it, an
    // injected <script> runs and the rest of the policy is decoration. It was
    // here for two things — Next's own bootstrap scripts, which Next nonces
    // itself once it sees a nonce in this header, and the GA4 init snippet,
    // which now takes the nonce explicitly.
    //
    // No 'strict-dynamic': it would make browsers ignore 'self' and the
    // googletagmanager host, and this app loads its chunks from 'self' and
    // gtag from that host. Keeping the allowlist is the more predictable of
    // the two, and the nonce is what closes the actual hole.
    //
    // Dev keeps 'unsafe-eval' because HMR needs it. Production does not.
    process.env.NODE_ENV === "development"
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://www.googletagmanager.com`
      : `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com`,

    // style-src still needs 'unsafe-inline' and is honestly labelled as such.
    // next/font inlines @font-face, the public site's components style
    // themselves with React style objects, and the admin panel has three data
    // driven bar widths. A nonce cannot cover a style *attribute* — only a
    // <style> element — so this cannot be closed by nonce alone.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.google-analytics.com",
    "font-src 'self' data:",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  const headers = response.headers;

  headers.set("Content-Security-Policy", cspFor(nonce));
  // Belt and braces with frame-ancestors, for older browsers.
  headers.set("X-Frame-Options", "DENY");
  // Stops the browser second-guessing Content-Type — the other half of the
  // upload hardening in lib/uploads.ts.
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()"
  );
  headers.set("X-DNS-Prefetch-Control", "on");

  // Only meaningful over TLS, and setting it in dev would pin localhost to
  // HTTPS in the developer's browser for two years.
  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return response;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // One nonce per response, shared by the CSP header and every inline script
  // in the document.
  //
  // Next needs it on the *request* headers as well: that is how it learns the
  // nonce to stamp on its own bootstrap scripts. Setting it only on the
  // response would leave those scripts unnonced and blocked by the very policy
  // this sets.
  const nonce = makeNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspFor(nonce));

  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin") && !PUBLIC_ADMIN_PAGES.has(pathname);

  // Login, logout, and the two halves of a password reset are the way *in* and
  // *out*; they cannot require an existing session or a token minted behind one.
  const isAuthEndpoint = AUTH_ENDPOINTS.has(pathname);

  if ((isAdminApi || isAdminPage) && !isAuthEndpoint) {
    const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

    if (!hasSession) {
      if (isAdminApi) {
        return applySecurityHeaders(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
          nonce
        );
      }
      const loginUrl = new URL("/admin/login", req.url);
      // Preserve where they were headed so login can return them there.
      loginUrl.searchParams.set("next", pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce);
    }

    if (isAdminApi && requiresCsrf(req.method) && !verifyCsrf(req)) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Invalid or missing CSRF token. Reload the page and try again." },
          { status: 403 }
        ),
        nonce
      );
    }
  }

  return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own static output and the hero frames.
     *
     * public/frames holds 360 images that the hero requests in a burst —
     * running middleware on each would add measurable latency to the one
     * thing on the site most sensitive to it.
     */
    "/((?!_next/static|_next/image|frames/|favicon.ico).*)",
  ],
};
