"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banner, Button, TextField } from "../components/ui";

/**
 * The sign-in form.
 *
 * `next`, `notice` and `canReset` arrive as props from the server page rather
 * than being read here with useSearchParams. Reading them here required a
 * Suspense boundary, and with it the server sent the form hidden for a script
 * to reveal — so in a browser where that script did not run, the sign-in page
 * was a blank screen.
 */
export default function LoginForm({
  next,
  notice,
  canReset,
}: {
  next: string | null;
  notice: string | null;
  canReset: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (data.mustChangePassword) {
        // Straight to the change screen rather than bouncing off a banner —
        // this account's password is one the operator didn't choose.
        router.push("/admin/password?forced=1");
      } else {
        // Middleware records where an unauthenticated request was headed so
        // the sign-in returns there. Only same-site paths are honoured: an
        // absolute or protocol-relative value would be an open redirect.
        const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
        router.push(safeNext);
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    // A landmark, not a bare div: axe flags content outside one because a
    // screen-reader user navigating by region would find nothing here.
    <main className="ad-login">
      <form
        // If the script never runs, a submit posts rather than putting the
        // password into the address bar.
        method="post"
        className="ad-login-card ad-stack"
        aria-labelledby="admin-signin-heading"
        onSubmit={onSubmit}
      >
        <div>
          <h1 id="admin-signin-heading" className="ad-page-title">
            Hilook Interiors
          </h1>
          <p className="ad-page-sub">Sign in to the admin panel.</p>
        </div>

        {notice && <Banner tone="info">{notice}</Banner>}

        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <p className="ad-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" block disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        {/* Only offered when the site can actually send the email. */}
        {canReset && (
          <p className="ad-page-sub">
            <Link href="/admin/forgot-password">Forgot password?</Link>
          </p>
        )}
      </form>
    </main>
  );
}
