import { listErrors } from "@/lib/repos/errors";
import ErrorList, { type ErrorView } from "./ErrorList";

/**
 * Errors, kept in this database rather than sent to a hosted service.
 *
 * The alternative on the table was Sentry. This app's error payloads can carry
 * a client's name, email and message straight out of the contact form, and
 * that is not data to hand to a third party as a side effect of wanting to
 * know when something breaks. See lib/repos/errors.ts.
 */
export default async function AdminErrorsPage() {
  const rows = await listErrors({ limit: 100 });

  const view: ErrorView[] = rows.map((row) => ({
    fingerprint: row.fingerprint,
    firstSeenAt: new Date(row.firstSeenAt).toISOString(),
    lastSeenAt: new Date(row.lastSeenAt).toISOString(),
    count: row.count,
    source: row.source,
    message: row.message,
    stack: row.stack,
    path: row.path,
    method: row.method,
  }));

  const total = view.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
      <header className="ad-page-head">
        <div>
          <h1 className="ad-page-title">Errors</h1>
          <p className="ad-page-sub">
            Failures caught on the server, grouped so one bug is one entry however often it happens.
            Nothing here leaves this database.
          </p>
        </div>
      </header>

      {view.length > 0 && (
        <div className="ad-stats ad-stats--spaced">
          <div className="ad-stat">
            <p className="ad-stat-label">Unresolved</p>
            <p className="ad-stat-value">{view.length}</p>
            <p className="ad-stat-note">distinct problems</p>
          </div>
          <div className="ad-stat">
            <p className="ad-stat-label">Occurrences</p>
            <p className="ad-stat-value">{total}</p>
            <p className="ad-stat-note">across those problems</p>
          </div>
        </div>
      )}

      <section className="ad-card">
        <div className="ad-card-body">
          <ErrorList initial={view} />
        </div>
      </section>
    </>
  );
}
