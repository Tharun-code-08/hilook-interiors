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
 * turn into enquiries. Both are computed from data already being collected;
 * richer dimensions (unique visitors, device, referrer paths) need the event
 * log that Phase 2 introduces.
 */

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(74,63,51,0.16)",
  padding: "1.5rem",
};

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
  return (
    <div style={CARD}>
      <p
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#8A6A33",
          marginBottom: "0.6rem",
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "2rem",
            color: "#26231F",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </p>
        {delta !== undefined && delta !== null && (
          <span
            style={{
              fontSize: "0.75rem",
              fontVariantNumeric: "tabular-nums",
              color: delta > 0 ? "#2F6B4F" : delta < 0 ? "#5A2630" : "#777168",
            }}
          >
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {hint && <p style={{ fontSize: "0.72rem", color: "#777168", marginTop: "0.4rem" }}>{hint}</p>}
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.8rem",
          marginBottom: "0.3rem",
        }}
      >
        <span style={{ color: "#26231F", textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: "#777168", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ background: "#EFEAE0", height: 6, borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, background: "#B08A4A", height: "100%", borderRadius: 3 }} />
      </div>
    </div>
  );
}

function TrendChart({ days }: { days: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.4rem", height: 120 }}>
        {days.map((d) => (
          <div
            key={d.key}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              height: "100%",
              justifyContent: "flex-end",
            }}
          >
            <span
              style={{
                fontSize: "0.62rem",
                color: "#777168",
                marginBottom: "0.25rem",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {d.value || ""}
            </span>
            <div
              title={`${d.label}: ${d.value}`}
              style={{
                width: "100%",
                height: `${Math.max(2, (d.value / max) * 100)}%`,
                background: "#B08A4A",
                borderRadius: "2px 2px 0 0",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
        {days.map((d, i) => (
          <span
            key={d.key}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              fontSize: "0.6rem",
              color: "#A6A093",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {i % 2 === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
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
    <div>
      {steps.map((step, i) => {
        const pctOfTop = Math.round((step.value / max) * 100);
        const previous = i > 0 ? steps[i - 1].value : null;
        const conversion =
          previous && previous > 0 ? Math.round((step.value / previous) * 100) : null;

        return (
          <div key={step.label} style={{ marginBottom: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.8rem",
                marginBottom: "0.3rem",
                gap: "0.5rem",
              }}
            >
              <span style={{ color: "#26231F" }}>{step.label}</span>
              <span style={{ color: "#777168", fontVariantNumeric: "tabular-nums" }}>
                {step.value}
                {conversion !== null && (
                  <span style={{ color: "#A6A093" }}> · {conversion}% of previous</span>
                )}
              </span>
            </div>
            <div style={{ background: "#EFEAE0", height: 10 }}>
              <div
                style={{
                  width: `${Math.max(pctOfTop, step.value > 0 ? 2 : 0)}%`,
                  background: i === steps.length - 1 ? "#173F35" : "#B08A4A",
                  height: "100%",
                }}
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
};

function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <p style={{ fontSize: "0.85rem", color: "#777168" }}>
        Nothing yet. Changes made in the admin panel will appear here.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", display: "grid", gap: "0.7rem" }}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            fontSize: "0.8rem",
          }}
        >
          <span style={{ color: "#26231F" }}>
            <strong style={{ fontWeight: 600 }}>{entry.actorName}</strong>{" "}
            {ACTION_LABEL[entry.action] ?? entry.action}{" "}
            <span style={{ color: "#777168" }}>
              {entry.entity}
              {entry.detail ? ` — ${entry.detail}` : ""}
            </span>
          </span>
          <time
            dateTime={entry.at}
            style={{ color: "#A6A093", whiteSpace: "nowrap", fontSize: "0.75rem" }}
          >
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
  const DAY = 86_400_000;
  const day0 = new Date().setHours(0, 0, 0, 0);

  // All aggregated in SQL now rather than by scanning arrays in memory — which
  // is what makes unique visitors and device split possible at all (M4).
  const [analytics, submissions, projects, reviews, activity] = await Promise.all([
    summary(),
    submissionStats(),
    listProjects(),
    listReviews(),
    recentAudit(20),
  ]);

  const submissionsLast7 = await submissionsBetween(day0 - 6 * DAY, Date.now());
  const submissionsPrior7 = await submissionsBetween(day0 - 13 * DAY, day0 - 6 * DAY);

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
    <div>
      <h1
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.6rem",
          marginBottom: "0.35rem",
          color: "#26231F",
        }}
      >
        Dashboard
      </h1>
      <p style={{ fontSize: "0.82rem", color: "#777168", marginBottom: "1.75rem" }}>
        Deltas compare the last 7 days with the 7 before.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "1rem",
          marginBottom: "2.5rem",
        }}
      >
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
        <Link
          href="/admin/submissions"
          style={{
            display: "block",
            background: "#26231F",
            color: "#F4F1EA",
            padding: "0.9rem 1.25rem",
            fontSize: "0.85rem",
            textDecoration: "none",
            marginBottom: "1.5rem",
          }}
        >
          {unread === 1 ? "1 enquiry is" : `${unread} enquiries are`} waiting for a reply →
        </Link>
      )}

      <div style={{ ...CARD, marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "0.95rem", marginBottom: "1.4rem", color: "#26231F" }}>
          Visits — last 14 days
        </h2>
        <TrendChart days={trend} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={CARD}>
          <h2 style={{ fontSize: "0.95rem", marginBottom: "0.4rem", color: "#26231F" }}>
            Enquiry funnel
          </h2>
          <p style={{ fontSize: "0.72rem", color: "#777168", marginBottom: "1.1rem" }}>
            All-time proportions, not a tracked cohort.
          </p>
          <Funnel
            visits={analytics.totalViews}
            reachedContact={analytics.reachedContact}
            submitted={submissions.total}
          />
        </div>

        <div style={CARD}>
          <h2 style={{ fontSize: "0.95rem", marginBottom: "1.1rem", color: "#26231F" }}>
            Recent activity
          </h2>
          <ActivityFeed entries={recentActivity} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <div style={CARD}>
          <h2 style={{ fontSize: "0.95rem", marginBottom: "1.1rem", color: "#26231F" }}>
            Popular sections
          </h2>
          {analytics.sections.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#777168" }}>No section views recorded yet.</p>
          ) : (
            analytics.sections.map((s) => (
              <Bar key={s.name} label={s.name} value={s.value} max={maxSection} />
            ))
          )}
        </div>

        <div style={CARD}>
          <h2 style={{ fontSize: "0.95rem", marginBottom: "1.1rem", color: "#26231F" }}>Devices</h2>
          {analytics.devices.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#777168" }}>No device data yet.</p>
          ) : (
            analytics.devices.map((d) => (
              <Bar key={d.name} label={d.name} value={d.value} max={maxDevice} />
            ))
          )}
          {analytics.browsers.length > 0 && (
            <p style={{ fontSize: "0.75rem", color: "#777168", marginTop: "1rem" }}>
              Top browsers: {analytics.browsers.map((b) => `${b.name} (${b.value})`).join(", ")}
            </p>
          )}
        </div>

        <div style={CARD}>
          <h2 style={{ fontSize: "0.95rem", marginBottom: "1.1rem", color: "#26231F" }}>
            Traffic sources
          </h2>
          {analytics.referrers.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#777168" }}>
              No referrer data yet — direct visits aren&rsquo;t attributed to a source.
            </p>
          ) : (
            analytics.referrers.map((r) => (
              <Bar key={r.host} label={r.host} value={r.value} max={maxReferrer} />
            ))
          )}
        </div>
      </div>

      <p style={{ fontSize: "0.78rem", color: "#777168", marginTop: "2rem", maxWidth: "60ch" }}>
        Collected first-party as visitors load the site — no external tracker. Page views are
        counted server-side; section views fire once each section scrolls into view. Unique visitors
        and device breakdown need the event log introduced in Phase 2.
      </p>
    </div>
  );
}
