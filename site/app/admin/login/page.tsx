import { emailConfigured } from "@/lib/email";
import LoginForm from "./LoginForm";

/**
 * Rendered per request, not prerendered.
 *
 * middleware.ts sends a nonce-based CSP, and a nonce only works if the HTML
 * carrying the scripts came from the same request that minted it. This route
 * was static, so its inline scripts were baked at build time with no nonce and
 * every one was blocked — and the form lives inside a Suspense boundary those
 * scripts deliver, so the page rendered as an empty shell with no way to sign
 * in.
 *
 * The config below only works from a server component. It was first added to
 * the "use client" file, where route-segment config is ignored, and the route
 * stayed static — hence the split: this file carries the config, LoginForm.tsx
 * carries the interactivity.
 *
 * Any newly added static page hits the same wall. The "no CSP violations" e2e
 * test is what catches it.
 */
export const dynamic = "force-dynamic";

/**
 * `next` (where to go after signing in) and `reset` (arriving from a completed
 * password reset) are read here, on the server, and handed to the form — see
 * LoginForm for why the form must not read them itself.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <LoginForm
      next={typeof params.next === "string" ? params.next : null}
      notice={params.reset === "1" ? "Password updated. Sign in with your new password." : null}
      canReset={emailConfigured()}
    />
  );
}
