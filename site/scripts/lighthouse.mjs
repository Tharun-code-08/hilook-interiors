/**
 * Runs Lighthouse CI against a throwaway production build.
 *
 * A wrapper rather than a bare `lhci autorun` in package.json because the
 * server LHCI starts needs environment set, and `VAR=x cmd` is not portable to
 * Windows shells — which is where this project is developed.
 *
 * The database is the same throwaway file the e2e suite uses, for the same
 * reason: an audit must never read or write development data, and
 * scripts/seed-e2e.mjs refuses to run against anything not named "e2e".
 *
 *   npm run lhci
 */
import { spawn } from "node:child_process";

const env = {
  ...process.env,

  // Only needs to exist and be stable for the run; nothing here is a secret,
  // and the throwaway database is discarded afterwards.
  SESSION_SECRET:
    process.env.SESSION_SECRET ?? "lighthouse-only-secret-not-used-anywhere-else-0123456789",
  // Its own database file, not data/e2e.db. Sharing it with the Playwright
  // suite meant whichever ran last owned the admin account, and the other
  // suite could no longer sign in — seed-e2e.mjs only requires the name to
  // contain "e2e", so this satisfies its guard while staying separate.
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ?? "file:./data/lighthouse-e2e.db",
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD ?? "lighthouse-admin-password-1234",

  // Canonicals and Open Graph URLs resolve against this. Lighthouse's SEO
  // audits check that canonical is absolute and well-formed, so it has to
  // match the origin the run actually visits.
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3101",

  // Its own build directory: a running `next dev` owns .next, and the two
  // clobber each other if an audit builds into the same place.
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-lhci",
};

if (!env.TURSO_DATABASE_URL.includes("e2e")) {
  console.error(
    "[lighthouse] TURSO_DATABASE_URL must point at a throwaway database containing 'e2e'.\n" +
      "[lighthouse] Refusing to audit against development or production data."
  );
  process.exit(1);
}

const child = spawn("npx", ["lhci", "autorun"], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error("[lighthouse] failed to start lhci:", err.message);
  process.exit(1);
});
