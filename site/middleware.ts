import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { requiresCsrf, verifyCsrf } from "@/lib/csrf";

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

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Next injects inline bootstrap scripts and, in dev, uses eval for HMR.
  // 'unsafe-inline' is required by the GA4 init snippet in
  // app/components/GoogleAnalytics.tsx; tightening this to a nonce is
  // tracked for Phase 5 when that component is revisited.
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com"
    : "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  // next/font inlines @font-face; styles are inline style objects throughout.
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

function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = response.headers;

  headers.set("Content-Security-Policy", CSP_DIRECTIVES);
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

  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";

  // The login and logout endpoints are the way *in* and *out*; they cannot
  // require an existing session or a token minted behind one.
  const isAuthEndpoint = pathname === "/api/admin/login" || pathname === "/api/admin/logout";

  if ((isAdminApi || isAdminPage) && !isAuthEndpoint) {
    const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

    if (!hasSession) {
      if (isAdminApi) {
        return applySecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
      }
      const loginUrl = new URL("/admin/login", req.url);
      // Preserve where they were headed so login can return them there.
      loginUrl.searchParams.set("next", pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }

    if (isAdminApi && requiresCsrf(req.method) && !verifyCsrf(req)) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Invalid or missing CSRF token. Reload the page and try again." },
          { status: 403 }
        )
      );
    }
  }

  return applySecurityHeaders(NextResponse.next());
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
