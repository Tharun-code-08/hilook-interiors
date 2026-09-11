"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banner, Button, TextField } from "../components/ui";

export default function ResetPasswordForm({
  token,
  username,
}: {
  token: string | null;
  username: string | null;
}) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(token === null);

  const tooShort = newPassword.length > 0 && newPassword.length < 12;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    newPassword.length >= 12 && newPassword === confirmPassword && status === "idle";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !token) return;

    setError("");
    setStatus("saving");

    try {
      const res = await fetch("/api/admin/password-reset/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // A link that went stale while the form was open gets the same screen
        // as one that was stale on arrival, with the way to get a new one.
        if (res.status === 400 && !data.fieldErrors) {
          setExpired(true);
        } else {
          setError(
            data.fieldErrors?.newPassword?.[0] || data.error || "Couldn't save that password."
          );
        }
        setStatus("idle");
        return;
      }

      router.replace("/admin/login?reset=1");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStatus("idle");
    }
  }

  return (
    <main className="ad-login">
      <div className="ad-login-card ad-stack">
        {expired ? (
          <>
            <div>
              <h1 className="ad-page-title">This link has expired</h1>
              <p className="ad-page-sub">
                This reset link has expired or has already been used. Links work once and last 30
                minutes.
              </p>
            </div>
            <p className="ad-page-sub">
              <Link href="/admin/forgot-password">Request a new link</Link>
            </p>
          </>
        ) : (
          <>
            <div>
              <h1 className="ad-page-title">Choose a new password</h1>
              <p className="ad-page-sub">
                {username ? (
                  <>
                    For the account <strong>{username}</strong>. Every device signed in to it will
                    be signed out.
                  </>
                ) : (
                  "Every device signed in to this account will be signed out."
                )}
              </p>
            </div>

            <form method="post" onSubmit={onSubmit} className="ad-stack">
              <TextField
                label="New password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                hint="At least 12 characters. A phrase you'll remember beats a short scramble."
                error={tooShort ? "Too short — use at least 12 characters." : undefined}
              />

              <TextField
                label="Confirm new password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={mismatch ? "Passwords don't match." : undefined}
              />

              {error && <Banner tone="danger">{error}</Banner>}

              <Button type="submit" variant="primary" block disabled={!canSubmit}>
                {status === "saving" ? "Saving…" : "Set new password"}
              </Button>
            </form>
          </>
        )}

        <p className="ad-page-sub">
          <Link href="/admin/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
