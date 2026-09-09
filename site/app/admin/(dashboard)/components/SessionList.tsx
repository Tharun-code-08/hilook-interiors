"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "./ConfirmDialog";
import { useMutation } from "./useMutation";
import { Badge, Button, Card, EmptyState, Loading } from "../../components/ui";

type SessionView = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
  ip: string | null;
  current: boolean;
};

/**
 * Turns a user-agent string into something a person can recognise.
 *
 * Deliberately coarse. The list exists so an operator can answer "is one of
 * these not me?", and browser plus platform is enough for that. Parsing
 * further would be more code, more wrong, and no more useful.
 */
function describe(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : /Firefox\//.test(userAgent)
            ? "Firefox"
            : "Browser";

  const platform = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad|iOS/.test(userAgent)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown platform";

  return `${browser} on ${platform}`;
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function SessionList() {
  const [rows, setRows] = useState<SessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const { mutate } = useMutation();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    const res = await adminFetch("/api/admin/sessions");
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(row: SessionView) {
    const ok = await confirm({
      title: row.current ? "Sign out of this device?" : `Sign out ${describe(row.userAgent)}?`,
      body: row.current
        ? "You'll be returned to the sign-in screen."
        : "That device will have to sign in again. Do this if you don't recognise it.",
      confirmLabel: "Sign out",
      tone: "danger",
    });
    if (!ok) return;

    const previous = rows;
    const done = await mutate(
      `/api/admin/sessions/${row.id}`,
      { method: "DELETE" },
      {
        optimistic: () => setRows((prev) => prev.filter((r) => r.id !== row.id)),
        rollback: () => setRows(previous),
        successMessage: row.current ? undefined : "Signed out.",
      }
    );

    // Revoking the current session means this browser no longer holds a
    // usable token; sending it back to the panel would only bounce it to the
    // sign-in screen with a flash of empty layout on the way.
    if (done && row.current) window.location.href = "/admin/login";
  }

  async function revokeOthers() {
    const others = rows.filter((r) => !r.current).length;
    const ok = await confirm({
      title: `Sign out ${others} other ${others === 1 ? "device" : "devices"}?`,
      body: "Every signed-in device except this one will have to sign in again.",
      confirmLabel: "Sign out everywhere else",
      tone: "danger",
    });
    if (!ok) return;

    await mutate(
      "/api/admin/sessions",
      { method: "DELETE" },
      { successMessage: "Other devices signed out." }
    );
    load();
  }

  const others = rows.filter((r) => !r.current).length;

  return (
    <Card
      title="Signed-in devices"
      description="Each device that has signed in to this account. Sign out anything you don't recognise."
      actions={
        others > 0 ? (
          <Button variant="danger-quiet" size="sm" onClick={revokeOthers}>
            Sign out everywhere else
          </Button>
        ) : undefined
      }
      bodyless
    >
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title="No active sessions" />
      ) : (
        <div className="ad-table-wrap" role="region" aria-label="Signed-in devices" tabIndex={0}>
          <table className="ad-table">
            <thead>
              <tr>
                <th scope="col">Device</th>
                <th scope="col">Last active</th>
                <th scope="col">Signed in</th>
                <th scope="col">IP</th>
                <th scope="col">
                  <span className="ad-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="ad-td-strong">
                    <div className="ad-row">
                      {describe(row.userAgent)}
                      {row.current && <Badge tone="info">This device</Badge>}
                    </div>
                  </td>
                  <td>
                    <time dateTime={row.lastSeenAt}>{relative(row.lastSeenAt)}</time>
                  </td>
                  <td>
                    <time dateTime={row.createdAt}>
                      {new Date(row.createdAt).toLocaleDateString()}
                    </time>
                  </td>
                  <td className="ad-mono">{row.ip ?? "—"}</td>
                  <td className="ad-td-actions">
                    <Button variant="danger-quiet" size="sm" onClick={() => revoke(row)}>
                      Sign out
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
