"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, Card, PageHeader, TextField } from "../../components/ui";
import SessionList from "../components/SessionList";
import { adminError, adminFetch } from "@/lib/admin-client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const forced = params.get("forced") === "1";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const tooShort = newPassword.length > 0 && newPassword.length < 12;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 12 &&
    newPassword === confirmPassword &&
    status !== "saving";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("saving");
    setError(null);
    setFieldErrors({});

    const res = await adminFetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      let details: Record<string, string[]> = {};
      try {
        const body = await res.clone().json();
        if (body?.fieldErrors) details = body.fieldErrors;
      } catch {
        /* fall back to the summary message */
      }
      setFieldErrors(details);
      setError(await adminError(res));
      setStatus("idle");
      return;
    }

    setStatus("done");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    if (forced) {
      // Navigate first, and use replace so the forced-change screen doesn't
      // sit in history behind the dashboard.
      //
      // This used to call router.refresh() and then push(). The refresh kicks
      // off its own server render, which swallowed the queued navigation — the
      // operator changed their password successfully and stayed on the screen
      // telling them to change it. Rendering /admin re-runs the layout anyway,
      // so the refresh was never needed here.
      router.replace("/admin");
    } else {
      // Not navigating, so an explicit refresh is what updates the nav badge.
      router.refresh();
    }
  }

  return (
    <>
      <PageHeader
        title={forced ? "Set a new password" : "Account security"}
        description={
          forced
            ? "This account is still using the password it was created with. Choose your own before continuing."
            : "Change your password and review the devices signed in to this account."
        }
      />

      <div className="ad-stack-lg">
        <Card title="Change password">
          <form onSubmit={onSubmit} className="ad-stack">
            <TextField
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              error={fieldErrors.currentPassword?.[0]}
            />

            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              hint="At least 12 characters. Length matters more than symbols — a phrase you’ll remember beats a short scramble."
              error={tooShort ? "Too short — use at least 12 characters." : undefined}
            />

            <TextField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={mismatch ? "Passwords don’t match." : undefined}
            />

            {error && <Banner tone="danger">{error}</Banner>}
            {status === "done" && <Banner tone="info">Password updated.</Banner>}

            <div className="ad-row">
              <Button type="submit" variant="primary" disabled={!canSubmit}>
                {status === "saving" ? "Saving…" : "Update password"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Not shown during the forced first change: the operator has one job
            on that screen, and a device list they cannot act on usefully yet
            is noise in front of it. */}
        {!forced && <SessionList />}
      </div>
    </>
  );
}
