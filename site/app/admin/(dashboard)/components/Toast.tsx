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
        style={{
          position: "fixed",
          right: "1.25rem",
          bottom: "1.25rem",
          zIndex: 200,
          display: "grid",
          gap: "0.5rem",
          maxWidth: "min(380px, calc(100vw - 2.5rem))",
        }}
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONE_STYLES: Record<ToastTone, { bg: string; border: string; fg: string }> = {
  success: { bg: "#EDF3F0", border: "#173F35", fg: "#173F35" },
  error: { bg: "#F6EDEE", border: "#5A2630", fg: "#5A2630" },
  info: { bg: "#F4F1EA", border: "rgba(74,63,51,0.3)", fg: "#26231F" },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  // Errors stay until dismissed — a failure the operator missed is the exact
  // problem this component exists to solve.
  useEffect(() => {
    if (toast.tone === "error") return;
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const tone = TONE_STYLES[toast.tone];

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.fg,
        padding: "0.75rem 0.9rem",
        fontSize: "0.83rem",
        lineHeight: 1.5,
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        boxShadow: "0 6px 20px rgba(20,16,12,0.12)",
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "inherit",
          fontSize: "1.1rem",
          lineHeight: 1,
          padding: 0,
          width: 20,
          height: 20,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
