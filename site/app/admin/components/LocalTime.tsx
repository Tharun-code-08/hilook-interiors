"use client";

import { useSyncExternalStore } from "react";

/**
 * A date or time in the viewer's own locale and timezone, without a hydration
 * mismatch.
 *
 * The admin lists used to call toLocaleString() while rendering. That runs
 * twice — once on the server, once in the browser — and on Vercel the server
 * is in UTC with an en-US locale while the studio is in India. The two strings
 * differed, and React discarded the server-rendered list and drew it again,
 * logging error #418. Reproduced by opening the Inbox and Admin users pages in
 * a browser whose locale differs from the server's.
 *
 * So the first render is fixed — an ISO-style date in UTC, identical on every
 * machine — and the viewer's local format replaces it straight after
 * hydration. useSyncExternalStore is what tells the two renders apart: React
 * uses the server snapshot while hydrating and the client snapshot after.
 */

const noSubscription = () => () => {};

export default function LocalTime({
  iso,
  variant = "datetime",
  className,
}: {
  iso: string;
  variant?: "date" | "datetime";
  className?: string;
}) {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false
  );

  const date = new Date(iso);
  const text = hydrated
    ? variant === "date"
      ? date.toLocaleDateString()
      : date.toLocaleString()
    : fixed(date, variant);

  return (
    <time className={className} dateTime={date.toISOString()}>
      {text}
    </time>
  );
}

/** YYYY-MM-DD, with HH:MM UTC for a datetime: the same on every machine. */
function fixed(date: Date, variant: "date" | "datetime"): string {
  const s = date.toISOString();
  return variant === "date" ? s.slice(0, 10) : `${s.slice(0, 10)} ${s.slice(11, 16)} UTC`;
}
