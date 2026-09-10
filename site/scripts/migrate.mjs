/**
 * Applies the SQL migrations in drizzle/ and seeds the first owner account.
 *
 * Run before starting the app, and as a deploy step in production:
 *   npm run db:migrate
 *
 * Safe to run repeatedly — drizzle tracks applied migrations in its own table,
 * and the seed only fires when the users table is empty.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const remoteUrl = process.env.TURSO_DATABASE_URL;

let url;
if (remoteUrl) {
  url = remoteUrl;
  console.log(
    remoteUrl.startsWith("file:")
      ? `[migrate] target: local file ${remoteUrl.replace(/^file:/, "")}`
      : "[migrate] target: Turso (remote)"
  );
} else {
  url = `file:${root.split("\\").join("/")}/data/hilook.db`;
  console.log("[migrate] target: local file data/hilook.db");
}

/**
 * Ensure the directory holding a file-backed database exists.
 *
 * This used to happen only on the branch that builds the default URL, on the
 * assumption that TURSO_DATABASE_URL meant a remote database. It does not: the
 * e2e suite and the Lighthouse run both point it at a file: URL under data/,
 * so the mkdir was skipped and libSQL failed with SQLITE_CANTOPEN — data/ is
 * git-ignored and does not exist in a fresh checkout.
 *
 * Invisible on a developer machine, where data/ has existed since the first
 * dev server, and it surfaced on the very first CI run, where every checkout
 * is clean. Anyone cloning the repository and running the tests would have hit
 * exactly the same wall.
 */
if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length);
  const dir = dirname(filePath.startsWith("//") ? filePath.slice(2) : filePath);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
}

/**
 * A serverless deployment with a file-backed database is misconfigured.
 *
 * Vercel gives each invocation a read-only filesystem and discards the
 * container afterwards, so a file: URL there means writes either fail outright
 * or land somewhere that is about to disappear. None of that is visible at
 * build time: the build succeeds, the site comes up, and the first admin save
 * is what tells you.
 *
 * Failing here says so plainly instead — the same reasoning as lib/auth.ts
 * refusing to start without SESSION_SECRET rather than inventing one.
 */
if (process.env.VERCEL && url.startsWith("file:")) {
  console.error(
    [
      "[migrate] TURSO_DATABASE_URL is not set, so this would use a local SQLite file.",
      "[migrate] Vercel's filesystem is read-only and per-invocation, so every write",
      "[migrate] would fail or vanish. Create a database at https://turso.tech and set",
      "[migrate] TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on the project.",
    ].join("\n")
  );
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: join(root, "drizzle") });
  console.log("[migrate] schema up to date");
  await seedOwner();
} catch (error) {
  console.error("[migrate] failed:", error.message);
  process.exit(1);
} finally {
  client.close();
}

/**
 * Creates the first owner account when there is none.
 *
 * Nothing is hardcoded: set ADMIN_INITIAL_PASSWORD to choose it, otherwise a
 * random one is generated and printed exactly once. Either way the account is
 * flagged mustChangePassword, so the first sign-in is forced through the
 * change-password screen before the panel is reachable.
 */
async function seedOwner() {
  const existing = await client.execute("SELECT COUNT(*) AS n FROM users");
  if (Number(existing.rows[0].n) > 0) return;

  const fromEnv = process.env.ADMIN_INITIAL_PASSWORD;
  const generated = !fromEnv || fromEnv.length < 12;
  // 24 url-safe chars ≈ 143 bits — not meant to be memorised, just to survive
  // until the operator changes it at first login.
  const password = generated ? randomBytes(18).toString("base64url") : fromEnv;

  await client.execute({
    sql: `INSERT INTO users (id, username, password_hash, role, must_change_password, created_at)
          VALUES (?, ?, ?, 'owner', 1, ?)`,
    args: ["user-1", "admin", bcrypt.hashSync(password, 12), Date.now()],
  });

  console.log("");
  console.log("[migrate] Created the first owner account.");
  console.log("[migrate]   username: admin");
  if (generated) {
    console.log(`[migrate]   password: ${password}`);
    console.log("[migrate] This is shown once and stored nowhere else.");
  } else {
    console.log("[migrate]   password: (from ADMIN_INITIAL_PASSWORD)");
  }
  console.log("[migrate] You must change it at first sign-in.");
  console.log("");
}
