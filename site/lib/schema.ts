import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Schema for the libSQL/SQLite store that replaces data/db.json.
 *
 * Three things the JSON document couldn't do, and the reasons this exists:
 *
 *   - Transactions. Every write was read-modify-write on a whole-file
 *     serialise, so two concurrent admin saves silently lost one (finding C5).
 *   - Durability off a writable disk. lowdb needs a filesystem the app can
 *     write to at request time, which serverless doesn't provide (C1).
 *   - Aggregation. Analytics were running counters because a JSON blob can't
 *     be grouped or filtered by date (M4).
 *
 * Timestamps are stored as epoch milliseconds (INTEGER) rather than ISO text:
 * they sort and range-filter correctly as numbers, which the analytics
 * queries depend on.
 */

const now = sql`(unixepoch() * 1000)`;

/* -------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------- */

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    image: text("image"),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [index("services_position_idx").on(t.position)]
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    /** Added for Phase 5's per-project routes; unique so URLs can't collide. */
    slug: text("slug").notNull(),
    category: text("category", { enum: ["Residential", "Commercial"] })
      .notNull()
      .default("Residential"),
    description: text("description").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("projects_slug_idx").on(t.slug),
    index("projects_position_idx").on(t.position),
  ]
);

/**
 * Project images were a string[] inside the project document, which made an
 * image's order and alt text impossible to address individually. As rows they
 * get both, plus a real foreign key so deleting a project cleans up after
 * itself instead of orphaning references.
 */
export const projectImages = sqliteTable(
  "project_images",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("project_images_project_idx").on(t.projectId, t.position)]
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    photo: text("photo"),
    rating: integer("rating").notNull().default(5),
    text: text("text").notNull(),
    approved: integer("approved", { mode: "boolean" }).notNull().default(false),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [index("reviews_approved_idx").on(t.approved, t.position)]
);

export const processSteps = sqliteTable(
  "process_steps",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [index("process_steps_position_idx").on(t.position)]
);

export const awards = sqliteTable("awards", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["award", "press", "certification"] })
    .notNull()
    .default("award"),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  url: text("url"),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
});

/* -------------------------------------------------------------------------
 * Enquiries & media
 * ---------------------------------------------------------------------- */

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    message: text("message").notNull(),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    responded: integer("responded", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(now),

    /**
     * Caught by a spam check rather than dropped.
     *
     * The contact endpoint used to discard these outright and return the
     * normal success shape, so a false positive lost a client enquiry with
     * nothing behind it but a console warning. On a site whose enquiries are
     * the business, that is the wrong direction to fail in: storing a little
     * spam costs a row, and dropping one real enquiry costs a commission.
     *
     * The visitor still sees success either way — telling a bot which check it
     * tripped teaches the author to evade it.
     */
    flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
    /** "honeypot" | "timing" — which check caught it. */
    flagReason: text("flag_reason"),
  },
  (t) => [
    index("submissions_created_idx").on(t.createdAt),
    index("submissions_read_idx").on(t.read),
    // The inbox filters on this on every load, and spam is the larger side of
    // the split once a site has been up a while.
    index("submissions_flagged_idx").on(t.flagged, t.createdAt),
  ]
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    /** Display name only — never used to build a path. See lib/uploads.ts. */
    filename: text("filename").notNull(),
    /** Storage key, resolved to a URL by the active storage driver. */
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull().default("image/jpeg"),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes"),
    alt: text("alt").notNull().default(""),
    uploadedAt: integer("uploaded_at").notNull().default(now),
  },
  (t) => [index("media_uploaded_idx").on(t.uploadedAt)]
);

export const newsletterSubscribers = sqliteTable("newsletter_subscribers", {
  /** Lower-cased on write, so one person can't occupy several rows. */
  email: text("email").primaryKey(),
  createdAt: integer("created_at").notNull().default(now),
});

/* -------------------------------------------------------------------------
 * Accounts & operations
 * ---------------------------------------------------------------------- */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["owner", "editor"] })
      .notNull()
      .default("editor"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(true),
    passwordChangedAt: integer("password_changed_at"),
    lastLoginAt: integer("last_login_at"),
    createdAt: integer("created_at").notNull().default(now),
  },
  // Usernames are compared case-insensitively at login, so uniqueness has to
  // be enforced the same way or "Admin" and "admin" become two accounts.
  (t) => [uniqueIndex("users_username_idx").on(sql`lower(${t.username})`)]
);

/**
 * Server-side session records.
 *
 * The session cookie is a JWT, which is self-contained: the server could
 * verify one without storing anything, and that is what it did. The cost is
 * that nothing could ever take a token back. Signing out only deleted the
 * cookie, so a token captured beforehand — off a shared machine, a proxy log,
 * a stolen laptop — stayed valid for the rest of its seven days. Changing a
 * password did not end sessions elsewhere either, which is the one thing
 * people expect a password change to do.
 *
 * Each token now carries a jti matching a row here, and verification checks
 * the row is present, unrevoked and unexpired. That makes revocation a single
 * UPDATE, and it is what the sessions screen and "sign out everywhere" are
 * built on.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    /** The jti embedded in the token. */
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: integer("created_at").notNull().default(now),
    /** Throttled — written at most once every few minutes, not per request. */
    lastSeenAt: integer("last_seen_at").notNull().default(now),
    expiresAt: integer("expires_at").notNull(),
    /** Set on sign-out, on revoke, and on a password change elsewhere. */
    revokedAt: integer("revoked_at"),
    /** Enough to recognise a session in the list; not a fingerprint. */
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)]
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    at: integer("at").notNull().default(now),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    detail: text("detail"),
    ip: text("ip"),
  },
  (t) => [index("audit_log_at_idx").on(t.at)]
);

/**
 * Application errors, kept in the same database as everything else.
 *
 * The alternative considered was Sentry. This stays first-party for the same
 * reason the analytics do: an interiors studio's error payloads can carry
 * client names and addresses out of a contact form, and shipping those to a
 * third party is a decision worth not making by default.
 *
 * Grouped by fingerprint so a loop that throws ten thousand times is one row
 * with a count, not ten thousand rows that push everything else out of the
 * retention window.
 */
export const errorLog = sqliteTable(
  "error_log",
  {
    /** Hash of message + top stack frame. Same bug, same row. */
    fingerprint: text("fingerprint").primaryKey(),
    firstSeenAt: integer("first_seen_at").notNull().default(now),
    lastSeenAt: integer("last_seen_at").notNull().default(now),
    count: integer("count").notNull().default(1),
    /** "server" | "client" — where it was caught, not where it originated. */
    source: text("source", { enum: ["server", "client"] })
      .notNull()
      .default("server"),
    message: text("message").notNull(),
    stack: text("stack"),
    path: text("path"),
    method: text("method"),
    /** Who was signed in, when that is known. Never the request body. */
    actorId: text("actor_id"),
    userAgent: text("user_agent"),
    /** Set when someone marks it dealt with; keeps the list to what is live. */
    resolvedAt: integer("resolved_at"),
  },
  (t) => [index("error_log_last_seen_idx").on(t.lastSeenAt)]
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    /** "bucket:identifier" */
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: integer("window_start").notNull(),
  },
  (t) => [index("rate_limits_window_idx").on(t.windowStart)]
);

/** Key/value rather than one wide row, so a single field can be updated atomically. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* -------------------------------------------------------------------------
 * Analytics
 * ---------------------------------------------------------------------- */

/**
 * Append-only event log.
 *
 * The counters this replaces could only ever answer "how many, ever". Rows
 * can be grouped by day, filtered to a range, and counted distinct — which is
 * what makes unique visitors, device split, and period-over-period deltas
 * possible at all.
 *
 * Appending also removes the write contention: an INSERT never reads first,
 * so concurrent page views can't lose each other's increments.
 */
export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: integer("at").notNull().default(now),
    type: text("type", { enum: ["pageview", "section"] }).notNull(),
    path: text("path"),
    section: text("section"),
    referrerHost: text("referrer_host"),
    /**
     * Daily-salted hash of IP + user agent. Lets us count distinct visitors
     * per day without storing anything that identifies a person: the salt
     * rotates at midnight, so yesterday's hashes can't be linked to today's,
     * and no raw IP is ever written.
     */
    visitorHash: text("visitor_hash"),
    deviceClass: text("device_class", { enum: ["mobile", "tablet", "desktop", "unknown"] }),
    browser: text("browser"),
  },
  (t) => [
    index("analytics_at_idx").on(t.at),
    index("analytics_type_at_idx").on(t.type, t.at),
    index("analytics_visitor_idx").on(t.visitorHash, t.at),
  ]
);
