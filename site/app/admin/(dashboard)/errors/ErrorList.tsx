"use client";

import { useState } from "react";
import { Badge, Button, EmptyState } from "../../components/ui";
import { useMutation } from "../components/useMutation";

export type ErrorView = {
  fingerprint: string;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
  source: "server" | "client";
  message: string;
  stack: string | null;
  path: string | null;
  method: string | null;
};

/**
 * The error list, with each row expandable to its stack.
 *
 * Collapsed by default: a stack trace is the thing you want once you have
 * decided which error to look at, and printing all of them turns the page into
 * something nobody scrolls through.
 */
export default function ErrorList({ initial }: { initial: ErrorView[] }) {
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const { mutate } = useMutation();

  async function resolve(fingerprint: string) {
    const previous = rows;
    await mutate(
      `/api/admin/errors/${fingerprint}`,
      { method: "POST" },
      {
        optimistic: () => setRows((prev) => prev.filter((r) => r.fingerprint !== fingerprint)),
        rollback: () => setRows(previous),
        successMessage: "Marked resolved.",
      }
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState title="No unresolved errors">
        Failures caught on the server are recorded here automatically.
      </EmptyState>
    );
  }

  return (
    <ul className="ad-stack">
      {rows.map((row) => (
        <li key={row.fingerprint} className="ad-error-row">
          <div className="ad-row">
            <Badge tone={row.count > 10 ? "danger" : "warn"}>
              {row.count}×{row.count > 10 ? " recurring" : ""}
            </Badge>
            <Badge>{row.source}</Badge>
            {row.path && (
              <span className="ad-mono">
                {row.method} {row.path}
              </span>
            )}
            <div className="ad-spacer" />
            <time className="ad-muted" dateTime={row.lastSeenAt}>
              {new Date(row.lastSeenAt).toLocaleString()}
            </time>
          </div>

          <p className="ad-error-message">{row.message}</p>

          <div className="ad-row">
            {row.stack && (
              <Button
                size="sm"
                onClick={() => setOpen(open === row.fingerprint ? null : row.fingerprint)}
                aria-expanded={open === row.fingerprint}
              >
                {open === row.fingerprint ? "Hide stack" : "Show stack"}
              </Button>
            )}
            <div className="ad-spacer" />
            <Button size="sm" onClick={() => resolve(row.fingerprint)}>
              Mark resolved
            </Button>
          </div>

          {open === row.fingerprint && row.stack && (
            <pre className="ad-stack-trace">{row.stack}</pre>
          )}
        </li>
      ))}
    </ul>
  );
}
