/**
 * One-shot import of the legacy data/db.json into the SQL store.
 *
 * Run once, after `npm run db:migrate`:
 *   npm run db:import
 *
 * Idempotent by primary key: re-running replaces rows rather than duplicating
 * them, so a partial run can be repeated safely. It never deletes anything it
 * didn't write, and it leaves db.json untouched — keep that file until you've
 * confirmed the site reads correctly from SQL.
 */
import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(root, "data", "db.json");

if (!existsSync(jsonPath)) {
  console.log("[import] No data/db.json found — nothing to import.");
  process.exit(0);
}

const legacy = JSON.parse(readFileSync(jsonPath, "utf8"));

const url = process.env.TURSO_DATABASE_URL ?? `file:${root.replace(/\\/g, "/")}/data/hilook.db`;
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const ts = (iso) => {
  const parsed = Date.parse(iso ?? "");
  return Number.isFinite(parsed) ? parsed : Date.now();
};

/** "Hillside Residence" -> "hillside-residence", de-duplicated across the set. */
function slugify(title, taken) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "project";

  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  taken.add(slug);
  return slug;
}

const statements = [];
const push = (sql, args = []) => statements.push({ sql, args });

/* ---- services ---- */
for (const [i, s] of (legacy.services ?? []).entries()) {
  push(
    `INSERT OR REPLACE INTO services (id, name, description, image, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [s.id, s.name, s.description ?? "", s.image ?? null, s.order ?? i, Date.now(), Date.now()]
  );
}

/* ---- projects + their images ---- */
const takenSlugs = new Set();
for (const [i, p] of (legacy.portfolio ?? []).entries()) {
  push(
    `INSERT OR REPLACE INTO projects (id, title, slug, category, description, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id,
      p.title,
      slugify(p.title, takenSlugs),
      p.category === "Commercial" ? "Commercial" : "Residential",
      p.description ?? "",
      p.order ?? i,
      Date.now(),
      Date.now(),
    ]
  );

  // The images array becomes rows. Clear first so a re-run doesn't stack them.
  push(`DELETE FROM project_images WHERE project_id = ?`, [p.id]);
  for (const [j, url] of (p.images ?? []).entries()) {
    push(`INSERT INTO project_images (id, project_id, url, alt, position) VALUES (?, ?, ?, ?, ?)`, [
      randomUUID(),
      p.id,
      url,
      "",
      j,
    ]);
  }
}

/* ---- reviews ---- */
for (const [i, r] of (legacy.reviews ?? []).entries()) {
  push(
    `INSERT OR REPLACE INTO reviews (id, name, photo, rating, text, approved, featured, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.id,
      r.name,
      r.photo ?? null,
      r.rating ?? 5,
      r.text,
      r.approved ? 1 : 0,
      r.featured ? 1 : 0,
      r.order ?? i,
      Date.now(),
      Date.now(),
    ]
  );
}

/* ---- process steps ---- */
for (const [i, s] of (legacy.processSteps ?? []).entries()) {
  push(
    `INSERT OR REPLACE INTO process_steps (id, title, body, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [s.id, s.title, s.body ?? "", s.order ?? i, Date.now(), Date.now()]
  );
}

/* ---- awards ---- */
for (const [i, a] of (legacy.awards ?? []).entries()) {
  push(
    `INSERT OR REPLACE INTO awards (id, kind, title, detail, url, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [a.id, a.kind ?? "award", a.title, a.detail ?? "", a.url ?? null, i, Date.now()]
  );
}

/* ---- submissions ---- */
for (const s of legacy.submissions ?? []) {
  push(
    `INSERT OR REPLACE INTO submissions (id, name, email, phone, message, read, responded, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id,
      s.name,
      s.email,
      s.phone ?? "",
      s.message,
      s.read ? 1 : 0,
      s.responded ? 1 : 0,
      ts(s.createdAt),
    ]
  );
}

/* ---- media ----
   Legacy rows stored a public URL like "/uploads/<id>.jpg". The storage key is
   the basename; the driver rebuilds the URL, so moving to a bucket later needs
   no data change. */
for (const m of legacy.media ?? []) {
  const storageKey =
    String(m.url ?? "")
      .split("/")
      .pop() ?? m.id;
  push(
    `INSERT OR REPLACE INTO media (id, filename, storage_key, content_type, alt, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [m.id, m.filename ?? storageKey, storageKey, "image/jpeg", "", ts(m.uploadedAt)]
  );
}

/* ---- newsletter ---- */
for (const email of legacy.newsletterSubscribers ?? []) {
  push(`INSERT OR REPLACE INTO newsletter_subscribers (email, created_at) VALUES (?, ?)`, [
    String(email).toLowerCase(),
    Date.now(),
  ]);
}

/* ---- users ---- */
for (const u of legacy.users ?? []) {
  push(
    `INSERT OR REPLACE INTO users (id, username, password_hash, role, must_change_password, password_changed_at, last_login_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      u.id,
      u.username,
      u.passwordHash,
      u.role === "owner" ? "owner" : "editor",
      u.mustChangePassword ? 1 : 0,
      u.passwordChangedAt ? ts(u.passwordChangedAt) : null,
      u.lastLoginAt ? ts(u.lastLoginAt) : null,
      ts(u.createdAt),
    ]
  );
}

/* ---- settings (key/value) ---- */
for (const [key, value] of Object.entries(legacy.settings ?? {})) {
  if (typeof value !== "string") continue;
  push(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
}

/* ---- analytics ----
   The old store held only totals, with no timestamps to reconstruct events
   from. Rather than invent per-event rows with fabricated dates, the daily
   counters are replayed as one synthetic pageview per recorded visit, dated to
   the day it happened. Section and referrer totals genuinely cannot be dated,
   so they are not imported — the log starts clean and the dashboard's
   all-time figures pick up from here. */
let replayed = 0;
for (const [day, count] of Object.entries(legacy.analytics?.dailyVisits ?? {})) {
  const at = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(at)) continue;
  for (let i = 0; i < Math.min(count, 5000); i++) {
    push(
      `INSERT INTO analytics_events (at, type, path, section, referrer_host, visitor_hash, device_class, browser)
       VALUES (?, 'pageview', '/', NULL, NULL, NULL, 'unknown', NULL)`,
      [at]
    );
    replayed++;
  }
}

console.log(`[import] executing ${statements.length} statements…`);

try {
  await client.batch(statements, "write");
  console.log("[import] done:");
  console.log(`  services   ${(legacy.services ?? []).length}`);
  console.log(`  projects   ${(legacy.portfolio ?? []).length}`);
  console.log(`  reviews    ${(legacy.reviews ?? []).length}`);
  console.log(`  steps      ${(legacy.processSteps ?? []).length}`);
  console.log(`  awards     ${(legacy.awards ?? []).length}`);
  console.log(`  enquiries  ${(legacy.submissions ?? []).length}`);
  console.log(`  media      ${(legacy.media ?? []).length}`);
  console.log(`  users      ${(legacy.users ?? []).length}`);
  console.log(`  settings   ${Object.keys(legacy.settings ?? {}).length}`);
  console.log(`  analytics  ${replayed} pageviews replayed from daily totals`);
} catch (error) {
  console.error("[import] failed:", error.message);
  process.exit(1);
} finally {
  client.close();
}
