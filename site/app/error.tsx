"use client";

import { useEffect } from "react";
import StatusPage from "./components/StatusPage";

/**
 * Route-level error boundary. Catches throws from the page and its children.
 * A failure in the root layout itself escapes this and lands in
 * app/global-error.tsx instead.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Phase 7 replaces this with a real error reporter. Until then the digest
    // is the only handle you have for correlating a user report with a server
    // log line, so make sure it reaches the console.
    console.error("[hilook] unhandled render error", error.digest ?? "", error);
  }, [error]);

  return (
    <StatusPage
      code="Error"
      title="Something went wrong on our end."
      body="This isn't your fault. Try again — if it keeps happening, get in touch and we'll take a look."
    >
      <button type="button" onClick={reset} className="hi-cta" style={{ border: "none" }}>
        Try again
      </button>
      {/* A hard navigation, not next/link. This boundary catches render errors,
          so the router and client state are the things most likely to be in a
          bad way — a full document load is the reliable escape hatch. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="hi-cta-outline">
        Return home
      </a>
      {error.digest && (
        <p
          style={{
            width: "100%",
            marginTop: "1.5rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.72rem",
            color: "#777168",
          }}
        >
          Reference: {error.digest}
        </p>
      )}
    </StatusPage>
  );
}
