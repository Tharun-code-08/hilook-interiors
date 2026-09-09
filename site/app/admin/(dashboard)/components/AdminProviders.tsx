"use client";

import { ToastProvider } from "./Toast";
import { ConfirmProvider } from "./ConfirmDialog";

/**
 * Client-side providers for the admin panel. Kept in one component so the
 * layout (a server component) can mount them without becoming a client
 * component itself.
 */
export default function AdminProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
