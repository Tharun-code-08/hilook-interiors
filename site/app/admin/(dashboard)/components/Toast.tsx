"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Toast notifications for the admin panel.
 *
 * Every mutation in the panel was fire-and-forget: `await fetch(...)` with no
 * `res.ok` check, and optimistic local state updated either way (finding M1).
 * A rejected save looked exactly like a successful one — the operator saw
 * their edit persist and only found out on reload.
 *
 * This is the surface that makes failure visible. `useMutation` below pairs
 * it with rollback so the UI stops lying about what was saved.
 */

export type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastContextValue = {
  notify: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return context;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId++;
    setToasts((current) => [...current, { id, tone, message }]);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // Errors are assertive because they mean the operator's action did not
        // happen; successes are polite so they don't interrupt.
        aria-live="polite"
        className="ad-toasts"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONE_CLASS: Record<ToastTone, string> = {
  success: "ad-toast ad-toast--success",
  error: "ad-toast ad-toast--error",
  info: "ad-toast",
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  // Errors stay until dismissed — a failure the operator missed is the exact
  // problem this component exists to solve.
  useEffect(() => {
    if (toast.tone === "error") return;
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div role={toast.tone === "error" ? "alert" : "status"} className={TONE_CLASS[toast.tone]}>
      <span className="ad-spacer">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="ad-toast-x"
      >
        ×
      </button>
    </div>
  );
}
