import { recentAudit } from "@/lib/repos/operations";
import { Badge } from "../../components/ui";

/**
 * The audit log, unfiltered.
 *
 * The dashboard's activity feed deliberately hides `login.failed` — a "what
 * changed" list is not improved by someone fat-fingering their password. But
 * that is exactly the entry that matters when the question is "is anyone
 * trying to get in", and until now there was nowhere to see it. This is that
 * view: everything, newest first, with the sign-in attempts called out.
 */

const ACTION_LABEL: Record<string, string> = {
  login: "signed in",
  "login.failed": "failed sign-in",
  logout: "signed out",
  "password.change": "changed password",
  "session.revoke": "revoked a session",
  create: "created",
  update: "updated",
  delete: "deleted",
  reorder: "reordered",
  upload: "uploaded",
  export: "exported",
};

/** Entries worth a second look rather than a scroll past. */
const NOTABLE = new Set(["login.failed", "password.change", "session.revoke", "delete"]);

export default async function AdminActivityPage() {
  const entries = await recentAudit(200);
  const failedSignIns = entries.filter((e) => e.action === "login.failed").length;

  return (
    <>
      <header className="ad-page-head">
        <div>
          <h1 className="ad-page-title">Activity</h1>
          <p className="ad-page-sub">
            Every action taken in the panel, including sign-in attempts that failed. Kept to the
            most recent 200 entries.
          </p>
        </div>
      </header>

      {failedSignIns > 0 && (
        <div className="ad-banner ad-banner--warn">
          <span>
            {failedSignIns} failed sign-in {failedSignIns === 1 ? "attempt" : "attempts"} in this
            window. A handful is someone mistyping; a run of them from one address is not.
          </span>
        </div>
      )}

      <section className="ad-card">
        {entries.length === 0 ? (
          <div className="ad-empty">
            <p className="ad-empty-title">Nothing recorded yet</p>
            Actions taken in the panel appear here.
          </div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Action</th>
                  <th scope="col">Detail</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                    </td>
                    <td className="ad-td-strong">{entry.actorName}</td>
                    <td>
                      {NOTABLE.has(entry.action) ? (
                        <Badge tone={entry.action === "login.failed" ? "danger" : "warn"}>
                          {ACTION_LABEL[entry.action] ?? entry.action}
                        </Badge>
                      ) : (
                        (ACTION_LABEL[entry.action] ?? entry.action)
                      )}
                    </td>
                    <td>
                      {entry.entity}
                      {entry.detail ? ` — ${entry.detail}` : ""}
                    </td>
                    <td className="ad-mono">{entry.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
