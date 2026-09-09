import { getDB } from "@/lib/db";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(74,63,51,0.16)", padding: "1.5rem" }}>
      <p style={{ fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#B08A4A", marginBottom: "0.6rem" }}>
        {label}
      </p>
      <p style={{ fontFamily: "Georgia, serif", fontSize: "2rem", color: "#26231F" }}>{value}</p>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
        <span style={{ color: "#26231F", textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: "#777168" }}>{value}</span>
      </div>
      <div style={{ background: "#EFEAE0", height: 6, borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, background: "#B08A4A", height: "100%", borderRadius: 3 }} />
      </div>
    </div>
  );
}

function last14Days(dailyVisits: Record<string, number>) {
  const days: { key: string; label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dailyVisits[key] || 0,
    });
  }
  return days;
}

function TrendChart({ days }: { days: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.4rem", height: 120 }}>
        {days.map((d) => (
          <div key={d.key} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontSize: "0.62rem", color: "#777168", marginBottom: "0.25rem", whiteSpace: "nowrap" }}>{d.value || ""}</span>
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

export default async function AdminDashboardPage() {
  const db = await getDB();
  const { pageviews, sections, referrers, totalVisits, dailyVisits } = db.data.analytics;
  const submissions = db.data.submissions;
  const unread = submissions.filter((s) => !s.read).length;

  const sectionEntries = Object.entries(sections).sort((a, b) => b[1] - a[1]);
  const maxSection = sectionEntries.length ? sectionEntries[0][1] : 0;
  const referrerEntries = Object.entries(referrers).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxReferrer = referrerEntries.length ? referrerEntries[0][1] : 0;
  const trend = last14Days(dailyVisits);
  const last7 = trend.slice(7).reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem", marginBottom: "1.75rem", color: "#26231F" }}>
        Dashboard
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
        <StatCard label="Total Page Views" value={totalVisits} />
        <StatCard label="Views (Last 7 Days)" value={last7} />
        <StatCard label="Contact Submissions" value={submissions.length} />
        <StatCard label="Unread Inquiries" value={unread} />
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(74,63,51,0.16)", padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "0.95rem", marginBottom: "1.4rem", color: "#26231F" }}>Visits — Last 14 Days</h2>
        <TrendChart days={trend} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        <div style={{ background: "#fff", border: "1px solid rgba(74,63,51,0.16)", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "0.95rem", marginBottom: "1.1rem", color: "#26231F" }}>Popular Sections</h2>
          {sectionEntries.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#777168" }}>No section views recorded yet.</p>
          ) : (
            sectionEntries.map(([name, value]) => (
              <Bar key={name} label={name} value={value} max={maxSection} />
            ))
          )}
        </div>

        <div style={{ background: "#fff", border: "1px solid rgba(74,63,51,0.16)", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "0.95rem", marginBottom: "1.1rem", color: "#26231F" }}>Traffic Sources</h2>
          {referrerEntries.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#777168" }}>
              No referrer data yet — direct visits aren&rsquo;t attributed to a source.
            </p>
          ) : (
            referrerEntries.map(([host, value]) => (
              <Bar key={host} label={host} value={value} max={maxReferrer} />
            ))
          )}
        </div>
      </div>

      <p style={{ fontSize: "0.78rem", color: "#777168", marginTop: "2rem", maxWidth: "60ch" }}>
        Analytics here are collected first-party as visitors load the site (no external tracker) —
        page views are counted server-side per request, and section views fire once each section
        scrolls into view.
      </p>
    </div>
  );
}
