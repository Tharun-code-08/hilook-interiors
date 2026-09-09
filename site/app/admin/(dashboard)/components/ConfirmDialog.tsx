"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui";

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
        <div className="ad-modal-backdrop" onClick={() => settle(false)}>
          <div
            ref={dialogRef}
            className="ad-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="hi-confirm-title"
            aria-describedby={request.body ? "hi-confirm-body" : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ad-card-body ad-stack">
              <h2 id="hi-confirm-title" className="ad-card-title">
                {request.title}
              </h2>
              {request.body && (
                <p id="hi-confirm-body" className="ad-muted">
                  {request.body}
                </p>
              )}
            </div>
            <div className="ad-card-foot ad-card-foot--end">
              <Button variant="secondary" onClick={() => settle(false)}>
                Cancel
              </Button>
              <Button
                ref={confirmButtonRef}
                variant={request.tone === "danger" ? "danger" : "primary"}
                onClick={() => settle(true)}
              >
                {request.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
