"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminError, adminFetch } from "@/lib/admin-client";
import { useToast } from "./Toast";

/**
 * Debounced, coalesced saving for the edit-in-place lists.
 *
 * What this replaces: every one of those lists called mutate() straight from
 * onChange, so a PUT went out per keystroke. Typing a forty-character
 * description was forty requests, forty audit-log rows, and forty chances for
 * two responses to land out of order and write a stale value back. It looked
 * fine on a fast local connection, which is exactly why it survived.
 *
 * Three things this has to get right, in order of how badly they bite:
 *
 *   1. Never lose an edit. A debounce means there is always a window where the
 *      newest keystrokes exist only on screen. Closing the tab or navigating
 *      inside that window must still send them — hence the unmount flush and
 *      the pagehide listener, both using keepalive so the request outlives the
 *      document.
 *
 *   2. Coalesce per record, not per field. Editing a title and then its
 *      description inside one window is one PUT carrying both, so the two
 *      cannot race each other.
 *
 *   3. Roll back to the right point. The snapshot is taken when a burst
 *      starts, not on the last keystroke, because the last keystroke is
 *      already the optimistic value we would be reverting.
 */

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Long enough to coalesce a burst of typing, short enough to feel immediate. */
const DEBOUNCE_MS = 700;

/** How long "Saved" stays up before the indicator goes quiet again. */
const SAVED_LINGER_MS = 2000;

type Entry<Snapshot> = {
  patch: Record<string, unknown>;
  timer: ReturnType<typeof setTimeout> | null;
  /** State as it was before this burst of edits began. */
  snapshot: Snapshot;
};

export function useAutosave<Snapshot>({
  endpoint,
  getSnapshot,
  restore,
}: {
  /** URL for one record. */
  endpoint: (id: string) => string;
  /** Current list, captured at the start of an edit burst for rollback. */
  getSnapshot: () => Snapshot;
  /** Put the list back the way `getSnapshot` found it. */
  restore: (snapshot: Snapshot) => void;
}) {
  const { notify } = useToast();
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Refs, not deps: the flush path runs from an unmount cleanup and from a
  // pagehide listener, both of which would otherwise close over whichever
  // render happened to register them.
  const endpointRef = useRef(endpoint);
  const getSnapshotRef = useRef(getSnapshot);
  const restoreRef = useRef(restore);
  endpointRef.current = endpoint;
  getSnapshotRef.current = getSnapshot;
  restoreRef.current = restore;

  const pending = useRef(new Map<string, Entry<Snapshot>>());
  const inFlight = useRef(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(
    (id: string, keepalive: boolean) => {
      const entry = pending.current.get(id);
      if (!entry) return;

      if (entry.timer) clearTimeout(entry.timer);
      pending.current.delete(id);

      const { patch, snapshot } = entry;
      inFlight.current += 1;
      setStatus("saving");

      // Not awaited on the unmount path — the point of keepalive is that the
      // request survives a document that is going away.
      void (async () => {
        try {
          const res = await adminFetch(endpointRef.current(id), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
            keepalive,
          });

          if (!res.ok) {
            // Only revert when the operator has stopped typing on this record.
            // If a newer burst is already queued, restoring the pre-burst
            // snapshot would throw away edits they can still see on screen —
            // and the queued save is about to reconcile anyway.
            if (!pending.current.has(id)) restoreRef.current(snapshot);
            notify(await adminError(res), "error");
            setStatus("error");
            return;
          }

          setStatus("saved");
        } catch {
          if (!pending.current.has(id)) restoreRef.current(snapshot);
          notify("Couldn't reach the server. Your last change wasn't saved.", "error");
          setStatus("error");
        } finally {
          inFlight.current -= 1;
        }
      })();
    },
    [notify]
  );

  /** Queue a patch. Apply it to local state yourself first — this only saves. */
  const save = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      const existing = pending.current.get(id);

      if (existing?.timer) clearTimeout(existing.timer);

      const entry: Entry<Snapshot> = existing
        ? { ...existing, patch: { ...existing.patch, ...patch } }
        : { patch, timer: null, snapshot: getSnapshotRef.current() };

      entry.timer = setTimeout(() => send(id, false), DEBOUNCE_MS);
      pending.current.set(id, entry);
      setStatus("saving");
    },
    [send]
  );

  /**
   * Queue and send immediately, without waiting out the debounce.
   *
   * For discrete actions — a checkbox, a select — where the operator has
   * finished expressing the change the moment they make it, and a delayed
   * "Saving…" reads as lag rather than as batching.
   */
  const saveNow = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      const existing = pending.current.get(id);
      if (existing?.timer) clearTimeout(existing.timer);
      pending.current.set(id, {
        patch: { ...(existing?.patch ?? {}), ...patch },
        timer: null,
        snapshot: existing?.snapshot ?? getSnapshotRef.current(),
      });
      send(id, false);
    },
    [send]
  );

  /** Send everything queued right now. */
  const flush = useCallback(
    (keepalive: boolean) => {
      for (const id of [...pending.current.keys()]) send(id, keepalive);
    },
    [send]
  );

  // A tab being hidden or closed is the common way an edit gets lost: the
  // debounce is still counting down and the document goes away underneath it.
  useEffect(() => {
    const onPageHide = () => flush(true);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flush]);

  // Client-side navigation away from the page unmounts this without ever
  // firing pagehide, so the cleanup has to flush too.
  //
  // The queue is captured into a local on the way in, per the exhaustive-deps
  // rule. That is safe here for the reason the rule cares about: pending.current
  // holds one Map created once and mutated in place, never reassigned, so the
  // local and the ref are the same object at cleanup time.
  useEffect(() => {
    const queue = pending.current;
    return () => {
      for (const id of [...queue.keys()]) send(id, true);
    };
  }, [send]);

  // "Saved" is a transient acknowledgement, not a resting state.
  useEffect(() => {
    if (status !== "saved") return;
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setStatus("idle"), SAVED_LINGER_MS);
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [status]);

  return { save, saveNow, flush, status };
}
