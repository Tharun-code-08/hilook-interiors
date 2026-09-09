import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and accessibility checks.
 *
 * Runs against a production build rather than the dev server: dev has HMR
 * overlays and unminified React warnings that pollute an axe scan, and the
 * hero's frame loading behaves differently without the production asset
 * pipeline.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // These share one database and one admin account; parallel workers would
  // race on login lockouts and CRUD fixtures.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Migrate first: that is what creates the schema and seeds the admin
        // account this suite signs in with.
        command:
          "npm run db:migrate && node scripts/seed-e2e.mjs && npm run build && npm run start -- --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        env: {
          // A fixed secret so sessions are stable across the run, and a
          // throwaway database so e2e never touches development data.
          SESSION_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
          TURSO_DATABASE_URL: "file:./data/e2e.db",
          NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
          ADMIN_INITIAL_PASSWORD: "e2e-admin-password-1234",
          // The suite posts the contact form more times in three minutes than
          // a person would in a month, and the chromium and mobile projects
          // share one address, so the production ceiling of 5/hour stops the
          // later tests storing anything and they fail on an empty inbox.
          // The limiter itself is covered by the integration tests.
          RATE_LIMIT_CONTACT: "200",
          RATE_LIMIT_NEWSLETTER: "200",
          // Its own build directory. A running `next dev` owns .next, and a
          // build into the same place leaves the two clobbering each other —
          // the symptom is a server that starts fine and then serves a
          // "500: Internal Server Error" shell.
          NEXT_DIST_DIR: ".next-e2e",
        },
      },
});
