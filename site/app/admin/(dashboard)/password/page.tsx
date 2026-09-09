"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminError, adminFetch } from "@/lib/admin-client";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.75rem",
  border: "1px solid rgba(74,63,51,0.28)",
  borderRadius: 2,
  fontSize: "0.9rem",
  fontFamily: "inherit",
  background: "#fff",
  color: "#26231F",
};

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
    <div style={{ maxWidth: 460 }}>
      <h1
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.6rem",
          marginBottom: "0.5rem",
          color: "#26231F",
        }}
      >
        {forced ? "Set a new password" : "Change password"}
      </h1>

      <p
        style={{ color: "#5E5951", fontSize: "0.9rem", lineHeight: 1.65, marginBottom: "1.75rem" }}
      >
        {forced
          ? "This account is still using the password it was created with. Choose your own before continuing."
          : "Choose a new password for your account. You'll stay signed in."}
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: "1.1rem" }}>
        <div>
          <label
            htmlFor="current-password"
            style={{
              display: "block",
              fontSize: "0.8rem",
              marginBottom: "0.35rem",
              color: "#26231F",
            }}
          >
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={inputStyle}
            aria-invalid={Boolean(fieldErrors.currentPassword)}
          />
          {fieldErrors.currentPassword && (
            <p style={{ color: "#5A2630", fontSize: "0.78rem", marginTop: "0.35rem" }}>
              {fieldErrors.currentPassword[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="new-password"
            style={{
              display: "block",
              fontSize: "0.8rem",
              marginBottom: "0.35rem",
              color: "#26231F",
            }}
          >
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
            aria-describedby="new-password-hint"
            aria-invalid={tooShort}
          />
          <p
            id="new-password-hint"
            style={{
              color: tooShort ? "#5A2630" : "#777168",
              fontSize: "0.78rem",
              marginTop: "0.35rem",
            }}
          >
            At least 12 characters. Length matters more than symbols — a phrase you'll remember
            beats a short scramble.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            style={{
              display: "block",
              fontSize: "0.8rem",
              marginBottom: "0.35rem",
              color: "#26231F",
            }}
          >
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
            aria-invalid={mismatch}
          />
          {mismatch && (
            <p style={{ color: "#5A2630", fontSize: "0.78rem", marginTop: "0.35rem" }}>
              Passwords don't match.
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            style={{
              background: "#F6EDEE",
              border: "1px solid #5A2630",
              color: "#5A2630",
              padding: "0.7rem 0.85rem",
              fontSize: "0.82rem",
            }}
          >
            {error}
          </p>
        )}

        {status === "done" && (
          <p
            role="status"
            style={{
              background: "#EDF3F0",
              border: "1px solid #173F35",
              color: "#173F35",
              padding: "0.7rem 0.85rem",
              fontSize: "0.82rem",
            }}
          >
            Password updated.
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            justifySelf: "start",
            background: canSubmit ? "#26231F" : "#A6A093",
            color: "#F4F1EA",
            border: "none",
            borderRadius: 2,
            padding: "0.7rem 1.6rem",
            fontSize: "0.8rem",
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {status === "saving" ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
