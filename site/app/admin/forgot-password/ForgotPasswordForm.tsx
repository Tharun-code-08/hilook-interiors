"use client";

import { useState } from "react";
import Link from "next/link";
import { Banner, Button, TextField } from "../components/ui";

export default function ForgotPasswordForm({ available }: { available: boolean }) {
  const [identifier, setIdentifier] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("sending");

    try {
      const res = await fetch("/api/admin/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Couldn't send a reset link just now. Please try again.");
        setStatus("idle");
        return;
      }

      setStatus("sent");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStatus("idle");
    }
  }

  return (
    <main className="ad-login">
      <div className="ad-login-card ad-stack">
        <div>
          <h1 className="ad-page-title">Reset your password</h1>
          <p className="ad-page-sub">
            Enter your username or the email address on your account, and we&rsquo;ll send you a
            link to choose a new password.
          </p>
        </div>

        {!available ? (
          <Banner tone="warn">
            Password reset by email isn&rsquo;t set up on this site yet. Ask the site owner to reset
            your password.
          </Banner>
        ) : status === "sent" ? (
          <Banner tone="info">
            If that matches an account with an email address, a reset link is on its way. It works
            once and expires in 30 minutes. If it hasn&rsquo;t arrived in a few minutes, check your
            spam folder.
          </Banner>
        ) : (
          // method="post" so that, if the script never runs, submitting cannot
          // put what was typed into the address bar.
          <form method="post" onSubmit={onSubmit} className="ad-stack">
            <TextField
              label="Username or email"
              name="identifier"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />

            {error && (
              <p className="ad-error" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              block
              disabled={status === "sending" || !identifier.trim()}
            >
              {status === "sending" ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="ad-page-sub">
          <Link href="/admin/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
