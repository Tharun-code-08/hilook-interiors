"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * useSearchParams opts the tree into client-side rendering, which Next
 * requires be wrapped in a Suspense boundary or the build fails while
 * prerendering this route.
 */
export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
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
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#26231F",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "1.5rem",
      }}
    >
      <form
        aria-labelledby="admin-signin-heading"
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#F4F1EA",
          padding: "2.5rem",
          borderRadius: 4,
        }}
      >
        <h1
          id="admin-signin-heading"
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "1.4rem",
            fontWeight: 400,
            color: "#26231F",
            marginBottom: "0.4rem",
          }}
        >
          Hilook Interiors
        </h1>
        <p style={{ fontSize: "0.8rem", color: "var(--hi-ink-soft)", marginBottom: "2rem" }}>
          Admin sign in
        </p>

        <label
          htmlFor="admin-username"
          style={{
            display: "block",
            fontSize: "0.75rem",
            color: "#5E5951",
            marginBottom: "0.4rem",
          }}
        >
          Username
        </label>
        <input
          id="admin-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={inputStyle}
        />

        <label
          htmlFor="admin-password"
          style={{
            display: "block",
            fontSize: "0.75rem",
            color: "#5E5951",
            margin: "1rem 0 0.4rem",
          }}
        >
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        {error && (
          <p role="alert" style={{ color: "#5A2630", fontSize: "0.8rem", marginTop: "1rem" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "1.75rem",
            width: "100%",
            background: "var(--hi-accent-strong)",
            color: "#F8F2E8",
            border: "none",
            padding: "0.8rem",
            fontSize: "0.75rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.8rem",
  border: "1px solid rgba(74,63,51,0.24)",
  background: "#fff",
  fontSize: "0.9rem",
  outline: "none",
};
