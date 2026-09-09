"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for throws in the root layout itself. It replaces the
 * whole document, so it must render its own <html>/<body> and cannot rely on
 * globals.css or the font variables the root layout normally provides —
 * everything here is self-contained on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[hilook] root layout error", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#F4F1EA",
          color: "#26231F",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "44ch" }}>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "#8A6A33",
              marginBottom: "1.25rem",
            }}
          >
            Error
          </p>
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(1.9rem, 4.5vw, 2.9rem)",
              lineHeight: 1.15,
              margin: "0 0 1.1rem",
            }}
          >
            Hilook Interiors is temporarily unavailable.
          </h1>
          <p
            style={{
              fontSize: "1.02rem",
              lineHeight: 1.75,
              color: "#5E5951",
              margin: "0 0 2.25rem",
            }}
          >
            We hit an unexpected problem loading the site. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#B08A4A",
              color: "#F8F2E8",
              border: "none",
              borderRadius: 2,
              padding: "0.9rem 2.6rem",
              fontSize: "0.7rem",
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: "1.5rem",
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: "0.72rem",
                color: "#777168",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
