"use client";

import { useCallback, useState } from "react";
import { adminError, adminFetch } from "@/lib/admin-client";
import { useToast } from "./Toast";

/**
 * One place where every admin mutation goes through, so none of them can
 * silently fail.
 *
 * The pattern this replaces, repeated across all nine admin pages:
 *
 *     setProjects(prev => prev.map(...));        // optimistic
 *     await fetch(url, { method: "PUT", ... });  // result ignored
 *
 * The local state updated whether or not the server accepted it, so a
 * rejected save was indistinguishable from a successful one until reload
 * (finding M1). Here, a failed request rolls the optimistic update back and
 * raises an error toast carrying the server's own message.
 */

export type MutationOptions<T> = {
  /** Applied immediately; reverted automatically if the request fails. */
  optimistic?: () => void;
  /** Undo for `optimistic`. Required whenever `optimistic` is given. */
  rollback?: () => void;
  /** Toast on success. Omit for mutations too minor to announce. */
  successMessage?: string;
  /** Runs only after the server confirms. */
  onSuccess?: (data: T) => void;
};

export function useMutation() {
  const { notify } = useToast();
  const [pending, setPending] = useState(false);

  const mutate = useCallback(
    async <T = unknown>(
      url: string,
      init: RequestInit,
      options: MutationOptions<T> = {}
    ): Promise<T | null> => {
      const { optimistic, rollback, successMessage, onSuccess } = options;

      optimistic?.();
      setPending(true);

      try {
        const res = await adminFetch(url, init);

        if (!res.ok) {
          rollback?.();
          notify(await adminError(res), "error");
          return null;
        }

        // 204 and empty bodies are legitimate; don't treat them as failure.
        let data: T | null = null;
        const text = await res.text();
        if (text) {
          try {
            data = JSON.parse(text) as T;
          } catch {
            data = null;
          }
        }

        if (successMessage) notify(successMessage, "success");
        if (data !== null) onSuccess?.(data);
        return data;
      } catch {
        rollback?.();
        notify("Couldn't reach the server. Check your connection and try again.", "error");
        return null;
      } finally {
        setPending(false);
      }
    },
    [notify]
  );

  return { mutate, pending };
}

/** Convenience wrappers so call sites read as intent, not HTTP. */
export function jsonBody(value: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}
