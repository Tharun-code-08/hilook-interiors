"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Replaces native confirm() for destructive admin actions (finding M2).
 *
 * Beyond looking like the rest of the panel, this fixes real problems with
 * the native dialog: it blocks the main thread, it can't name what is being
 * deleted in a way that survives translation, browsers increasingly suppress
 * it, and it offers no way to distinguish "delete this draft" from "delete
 * this client's project and its images".
 */

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
};

type Resolver = (confirmed: boolean) => void;

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setRequest(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  useEffect(() => {
    if (!request) return;

    // Focus the confirm button, but see the note on its styling: the
    // destructive action is not the default-styled one.
    confirmButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        settle(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {request && (
        <div
          onClick={() => settle(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 210,
            background: "rgba(18,14,10,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="hi-confirm-title"
            aria-describedby={request.body ? "hi-confirm-body" : undefined}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              border: "1px solid rgba(74,63,51,0.2)",
              maxWidth: 420,
              width: "100%",
              padding: "1.5rem",
            }}
          >
            <h2
              id="hi-confirm-title"
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "1.15rem",
                color: "#26231F",
                marginBottom: request.body ? "0.6rem" : "1.25rem",
              }}
            >
              {request.title}
            </h2>

            {request.body && (
              <p
                id="hi-confirm-body"
                style={{
                  fontSize: "0.87rem",
                  lineHeight: 1.6,
                  color: "#5E5951",
                  marginBottom: "1.5rem",
                }}
              >
                {request.body}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => settle(false)}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(74,63,51,0.28)",
                  color: "#26231F",
                  padding: "0.6rem 1.2rem",
                  minHeight: 40,
                  fontSize: "0.82rem",
                }}
              >
                Cancel
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => settle(true)}
                style={{
                  background: request.tone === "danger" ? "#5A2630" : "#26231F",
                  border: "none",
                  color: "#F4F1EA",
                  padding: "0.6rem 1.2rem",
                  minHeight: 40,
                  fontSize: "0.82rem",
                }}
              >
                {request.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
