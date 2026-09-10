import { requireAdmin } from "@/lib/admin-session";
import Link from "next/link";
import { summary } from "@/lib/repos/analytics";
import { listProjects, listReviews } from "@/lib/repos/content";
import { recentAudit, submissionStats, submissionsBetween } from "@/lib/repos/operations";
import type { AuditEntry } from "@/lib/types";

/**
 * Dashboard home.
 *
 * The previous version showed four running totals, a 14-day bar chart, and
 * two ranked lists. Every number was cumulative-since-install with nothing to
 * compare it against, so none of them answered a question anyone actually has
 * (finding M4).
 *
 * What changed: each tile carries a period-over-period delta, and the funnel
 * makes the one question the business cares about legible — how many visits
 * turn into enquiries.
 *
 * Everything here is a single series, so it is all one hue: the accent is a
 * magnitude encoding, not an identity one, and a second colour would imply a
 * distinction that does not exist. Deltas are the exception — those are status,
 * and they carry a glyph and a written direction so the meaning never rests on
 * colour alone.
 *
 * A server component, so it uses the stylesheet's classes directly rather than
 * the client primitives in app/admin/components/ui.tsx.
 */

function StatCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string | number;
  /** Percent change vs the preceding equal-length period. null = no basis. */
  delta?: number | null;
  hint?: string;
}) {
  const direction = delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <div className="ad-stat">
      <p className="ad-stat-label">{label}</p>
      <div className="ad-row">
        <p className="ad-stat-value">{value}</p>
        {direction && (
          <span
            className={
              direction === "up"
                ? "ad-delta ad-delta--up"
                : direction === "down"
                  ? "ad-delta ad-delta--down"
                  : "ad-delta"
            }
          >
            <span aria-hidden>{direction === "up" ? "▲" : direction === "down" ? "▼" : "—"}</span>{" "}
            {Math.abs(delta as number)}%
            <span className="ad-sr">
              {direction === "up" ? " increase" : direction === "down" ? " decrease" : " no change"}{" "}
              on the previous period
            </span>
          </span>
        )}
      </div>
      {hint && <p className="ad-stat-note">{hint}</p>}
    </div>
  );
}

/** One ranked row: a label, its value, and a bar showing share of the leader. */
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="ad-bar-row">
      <div className="ad-bar-head">
        <span className="ad-bar-label">{label}</span>
        <span className="ad-bar-value">{value}</span>
      </div>
      <div className="ad-meter">
        <div className="ad-meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrendChart({ days }: { days: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const total = days.reduce((sum, d) => sum + d.value, 0);

  // Every bar has a 2px floor so a quiet day is still a visible mark. With no
  // data at all that floor draws fourteen identical bars, which reads as flat
  // traffic rather than as no traffic — the one thing a chart must never do.
  if (total === 0) {
    return (
      <div className="ad-empty">
        <p className="ad-empty-title">No visits recorded yet</p>
        Traffic appears here once the site is live and receiving visitors.
      </div>
    );
  }

  return (
    <figure className="ad-trend">
      <div className="ad-trend-plot">
        {days.map((d) => (
          <div key={d.key} className="ad-trend-col" title={`${d.label}: ${d.value}`}>
            <span className="ad-trend-value">{d.value || ""}</span>
            <div
              className="ad-trend-bar"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="ad-trend-axis">
        {days.map((d, i) => (
          <span key={d.key} className="ad-trend-tick">
            {i % 2 === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      {/* The plot is decorative to a screen reader; this is the same data in
          words, so the section is not a hole in the page. */}
      <figcaption className="ad-sr">
        {total} views across the last {days.length} days. Highest day: {max}.
      </figcaption>
    </figure>
  );
}

/**
 * Visit → reached the contact section → submitted an enquiry.
 *
 * These are cumulative totals from different counters, so the funnel shows
 * proportion, not a cohort. Labelled as such rather than implying a tracked
 * journey it can't yet support.
 */
function Funnel({
  visits,
  reachedContact,
  submitted,
}: {
  visits: number;
  reachedContact: number;
  submitted: number;
}) {
  const steps = [
    { label: "Page views", value: visits },
    { label: "Reached contact section", value: reachedContact },
    { label: "Sent an enquiry", value: submitted },
  ];
  const max = Math.max(1, visits);

  return (
    <div className="ad-stack">
      {steps.map((step, i) => {
        const pctOfTop = Math.round((step.value / max) * 100);
        const previous = i > 0 ? steps[i - 1].value : null;
        const conversion =
          previous && previous > 0 ? Math.round((step.value / previous) * 100) : null;

        return (
          <div key={step.label} className="ad-bar-row">
            <div className="ad-bar-head">
              <span className="ad-bar-label">{step.label}</span>
              <span className="ad-bar-value">
                {step.value}
                {conversion !== null && (
                  <span className="ad-muted"> · {conversion}% of previous</span>
                )}
              </span>
            </div>
            <div className="ad-meter ad-meter--tall">
              <div
                className="ad-meter-fill"
                style={{ width: `${Math.max(pctOfTop, step.value > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  login: "signed in",
  "login.failed": "failed sign-in",
  logout: "signed out",
  "password.change": "changed password",
  create: "created",
  update: "updated",
  delete: "deleted",
  reorder: "reordered",
  upload: "uploaded",
  export: "exported",
  "session.revoke": "revoked a session",
};

function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="ad-muted">Nothing yet. Changes made in the panel will appear here.</p>;
  }

  return (
    <ul className="ad-stack">
      {entries.map((entry) => (
        <li key={entry.id} className="ad-activity">
          <span>
            <strong>{entry.actorName}</strong> {ACTION_LABEL[entry.action] ?? entry.action}{" "}
            <span className="ad-muted">
              {entry.entity}
              {entry.detail ? ` — ${entry.detail}` : ""}
            </span>
          </span>
          <time dateTime={entry.at} className="ad-muted">
            {new Date(entry.at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        </li>
      ))}
    </ul>
  );
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function AdminDashboardPage() {
  // Before any query: the layout's check does not cover this page's data.
  await requireAdmin();
  const DAY = 86_400_000;
  const day0 = new Date().setHours(0, 0, 0, 0);

  // All aggregated in SQL rather than by scanning arrays in memory — which is
  // what makes unique visitors and device split possible at all (M4).
  //
  // One Promise.all, not one plus two trailing awaits: the two submission
  // windows were sequential at the end for no reason, adding two round trips
  // to every dashboard render.
  const [analytics, submissions, projects, reviews, activity, submissionsLast7, submissionsPrior7] =
    await Promise.all([
      summary(),
      submissionStats(),
      listProjects(),
      listReviews(),
      recentAudit(20),
      submissionsBetween(day0 - 6 * DAY, Date.now()),
      submissionsBetween(day0 - 13 * DAY, day0 - 6 * DAY),
    ]);

  const unread = submissions.unread;
  const maxSection = analytics.sections[0]?.value ?? 0;
  const maxReferrer = analytics.referrers[0]?.value ?? 0;
  const maxDevice = analytics.devices[0]?.value ?? 0;

  const trend = analytics.dailyViews.map((d) => ({
    key: d.day,
    // Buckets are UTC days (see lib/repos/analytics.ts). Parsing at UTC noon
    // and formatting in UTC keeps the label on the same day the bucket means,
    // rather than shifting it by one in a westward timezone.
    label: new Date(`${d.day}T12:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
    value: d.value,
  }));

  // Failed sign-ins are security noise rather than activity; they stay in the
  // audit log but don't belong in a "what changed" feed.
  const recentActivity = activity.filter((entry) => entry.action !== "login.failed").slice(0, 8);

  return (
    <>
      <header className="ad-page-head">
        <div>
          <h1 className="ad-page-title">Dashboard</h1>
          <p className="ad-page-sub">Deltas compare the last 7 days with the 7 before.</p>
        </div>
      </header>

      <div className="ad-stack-lg">
        <div className="ad-stats">
          <StatCard
            label="Views (7 days)"
            value={analytics.viewsLast7}
            delta={percentChange(analytics.viewsLast7, analytics.viewsPrior7)}
            hint={`${analytics.totalViews} all time`}
          />
          <StatCard
            label="Enquiries (7 days)"
            value={submissionsLast7}
            delta={percentChange(submissionsLast7, submissionsPrior7)}
            hint={`${submissions.total} all time`}
          />
          <StatCard
            label="Unique visitors (7 days)"
            value={analytics.uniqueLast7}
            delta={percentChange(analytics.uniqueLast7, analytics.uniquePrior7)}
            hint="Daily-salted hash — no IP stored"
          />
          <StatCard
            label="Unread enquiries"
            value={unread}
            hint={unread > 0 ? "Waiting on a reply" : "All caught up"}
          />
          <StatCard
            label="Published projects"
            value={projects.length}
            hint={`${reviews.filter((r) => r.approved).length} approved reviews`}
          />
        </div>

        {unread > 0 && (
          <div className="ad-banner ad-banner--info">
            <span>
              {unread === 1 ? "1 enquiry is" : `${unread} enquiries are`} waiting for a reply.
            </span>
            <Link href="/admin/submissions">Open the inbox →</Link>
          </div>
        )}

        <section className="ad-card">
          <div className="ad-card-head">
            <h2 className="ad-card-title">Visits — last 14 days</h2>
          </div>
          <div className="ad-card-body">
            <TrendChart days={trend} />
          </div>
        </section>

        <div className="ad-cols">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2 className="ad-card-title">Enquiry funnel</h2>
                <p className="ad-card-sub">All-time proportions, not a tracked cohort.</p>
              </div>
            </div>
            <div className="ad-card-body">
              <Funnel
                visits={analytics.totalViews}
                reachedContact={analytics.reachedContact}
                submitted={submissions.total}
              />
            </div>
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <h2 className="ad-card-title">Recent activity</h2>
            </div>
            <div className="ad-card-body">
              <ActivityFeed entries={recentActivity} />
            </div>
          </section>
        </div>

        <div className="ad-cols">
          <section className="ad-card">
            <div className="ad-card-head">
              <h2 className="ad-card-title">Popular sections</h2>
            </div>
            <div className="ad-card-body">
              {analytics.sections.length === 0 ? (
                <p className="ad-muted">No section views recorded yet.</p>
              ) : (
                analytics.sections.map((s) => (
                  <Bar key={s.name} label={s.name} value={s.value} max={maxSection} />
                ))
              )}
            </div>
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <h2 className="ad-card-title">Devices</h2>
            </div>
            <div className="ad-card-body">
              {analytics.devices.length === 0 ? (
                <p className="ad-muted">No device data yet.</p>
              ) : (
                analytics.devices.map((d) => (
                  <Bar key={d.name} label={d.name} value={d.value} max={maxDevice} />
                ))
              )}
              {analytics.browsers.length > 0 && (
                <p className="ad-stat-note">
                  Top browsers: {analytics.browsers.map((b) => `${b.name} (${b.value})`).join(", ")}
                </p>
              )}
            </div>
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <h2 className="ad-card-title">Traffic sources</h2>
            </div>
            <div className="ad-card-body">
              {analytics.referrers.length === 0 ? (
                <p className="ad-muted">
                  No referrer data yet — direct visits aren&rsquo;t attributed to a source.
                </p>
              ) : (
                analytics.referrers.map((r) => (
                  <Bar key={r.host} label={r.host} value={r.value} max={maxReferrer} />
                ))
              )}
            </div>
          </section>
        </div>

        <p className="ad-page-sub">
          Collected first-party as visitors load the site — no external tracker. Page views are
          counted server-side; section views fire once each section scrolls into view.
        </p>
      </div>
    </>
  );
}
