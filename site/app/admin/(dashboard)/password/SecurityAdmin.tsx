"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Card, PageHeader, TextField } from "../../components/ui";
import SessionList from "../components/SessionList";
import { adminError, adminFetch } from "@/lib/admin-client";

export default function SecurityAdmin({
  forced,
  email,
  emailReady,
}: {
  forced: boolean;
  email: string | null;
  emailReady: boolean;
}) {
  const router = useRouter();

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

        {!forced && <RecoveryEmailCard initial={email} emailReady={emailReady} />}

        {/* Not shown during the forced first change: the operator has one job
            on that screen, and a device list they cannot act on usefully yet
            is noise in front of it. */}
        {!forced && <SessionList />}
      </div>
    </>
  );
}

/**
 * Where password reset links for this account are sent.
 *
 * Changing it asks for the current password: this address decides where the
 * keys to the account go, so an unattended session must not be enough to
 * point it somewhere else.
 */
function RecoveryEmailCard({
  initial,
  emailReady,
}: {
  initial: string | null;
  emailReady: boolean;
}) {
  const [email, setEmail] = useState(initial ?? "");
  const [saved, setSaved] = useState<string | null>(initial);
  const [currentPassword, setCurrentPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const changed = email.trim() !== (saved ?? "");
  const canSubmit = changed && currentPassword.length > 0 && status !== "saving";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("saving");
    setError(null);
    setFieldErrors({});

    const res = await adminFetch("/api/admin/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, email: email.trim() }),
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

    const body = await res.json();
    setSaved(body.email ?? null);
    setEmail(body.email ?? "");
    setCurrentPassword("");
    setStatus("done");
  }

  return (
    <Card
      title="Recovery email"
      description={
        emailReady
          ? "If you forget your password, the reset link is sent here."
          : "Reset links will be sent here once email sending is set up for this site."
      }
    >
      <form onSubmit={onSubmit} className="ad-stack">
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus("idle");
          }}
          hint={
            saved
              ? undefined
              : "None set. Without one, a forgotten password can't be reset by email."
          }
          error={fieldErrors.email?.[0]}
        />

        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          hint="Needed to change where reset links go."
          error={fieldErrors.currentPassword?.[0]}
        />

        {error && <Banner tone="danger">{error}</Banner>}
        {status === "done" && (
          <Banner tone="info">{saved ? "Recovery email saved." : "Recovery email removed."}</Banner>
        )}

        <div className="ad-row">
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {status === "saving" ? "Saving…" : "Save email"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
