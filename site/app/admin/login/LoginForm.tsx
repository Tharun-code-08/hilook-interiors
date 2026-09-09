"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, TextField } from "../components/ui";

/**
 * useSearchParams opts the tree into client-side rendering, which Next
 * requires be wrapped in a Suspense boundary or the build fails while
 * prerendering this route.
 */
export default function LoginForm() {
  return (
    <Suspense fallback={null}>
      <Form />
    </Suspense>
  );
}

function Form() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
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
        const requested = nextParam;
        const safeNext =
          requested && requested.startsWith("/") && !requested.startsWith("//")
            ? requested
            : "/admin";
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
      </form>
    </main>
  );
}
