/**
 * Test fixture: gives the e2e database enough content to render.
 *
 * db:migrate deliberately seeds only the owner account — a fresh production
 * install should start empty rather than shipping placeholder copy. But the
 * e2e suite needs a portfolio card to click and a service to list, so this
 * adds a minimal set.
 *
 * Only ever run against the throwaway e2e database (see playwright.config.ts).
 * It is a no-op if content already exists.
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url || !url.includes("e2e")) {
  console.error("[seed-e2e] refusing to run: TURSO_DATABASE_URL must point at an e2e database");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

/*
 * Per-run state is cleared even when the content seed is a no-op.
 *
 * playwright.config.ts reuses an existing server and database between local
 * runs, and the rate limiter is persistent (it has to be, to survive a
 * serverless cold start). So counters accumulate across runs: after three or
 * four passes the contact endpoint is legitimately throttled and the honeypot
 * test starts failing on a 429 that the app was right to send. The suite
 * passing only the first few times is worse than it failing outright, because
 * the failure looks like a regression in whatever was changed most recently.
 *
 * CI never sees this — it starts from a clean checkout — which is exactly why
 * it has to be handled here rather than noticed later.
 */
await client.execute("DELETE FROM rate_limits");
await client.execute("DELETE FROM submissions");
await client.execute("DELETE FROM newsletter_subscribers");
console.log("[seed-e2e] cleared rate limits and per-run submissions");

const existing = await client.execute("SELECT COUNT(*) AS n FROM projects");
if (Number(existing.rows[0].n) > 0) {
  console.log("[seed-e2e] content already present — nothing else to do");
  client.close();
  process.exit(0);
}

const now = Date.now();
const image = "/images/about/featured.jpg";

await client.batch(
  [
    {
      sql: `INSERT INTO projects (id, title, slug, category, description, position, created_at, updated_at)
            VALUES ('e2e-proj-1', 'Hillside Residence', 'hillside-residence', 'Residential', 'A full-home design.', 0, ?, ?)`,
      args: [now, now],
    },
    {
      sql: `INSERT INTO projects (id, title, slug, category, description, position, created_at, updated_at)
            VALUES ('e2e-proj-2', 'Harbour Offices', 'harbour-offices', 'Commercial', 'A workplace fit-out.', 1, ?, ?)`,
      args: [now, now],
    },
    {
      sql: `INSERT INTO project_images (id, project_id, url, alt, position) VALUES ('e2e-img-1', 'e2e-proj-1', ?, '', 0)`,
      args: [image],
    },
    {
      sql: `INSERT INTO project_images (id, project_id, url, alt, position) VALUES ('e2e-img-2', 'e2e-proj-1', ?, '', 1)`,
      args: [image],
    },
    {
      sql: `INSERT INTO project_images (id, project_id, url, alt, position) VALUES ('e2e-img-3', 'e2e-proj-2', ?, '', 0)`,
      args: [image],
    },
    {
      sql: `INSERT INTO services (id, name, description, position, created_at, updated_at)
            VALUES ('e2e-svc-1', 'Residential Interior Design', 'Full-home design.', 0, ?, ?)`,
      args: [now, now],
    },
    {
      sql: `INSERT INTO process_steps (id, title, body, position, created_at, updated_at)
            VALUES ('e2e-step-1', 'Consultation', 'We begin with a conversation.', 0, ?, ?)`,
      args: [now, now],
    },
    {
      sql: `INSERT INTO reviews (id, name, rating, text, approved, featured, position, created_at, updated_at)
            VALUES ('e2e-rev-1', 'A Client', 5, 'They were a pleasure to work with.', 1, 1, 0, ?, ?)`,
      args: [now, now],
    },
  ],
  "write"
);

console.log("[seed-e2e] seeded 2 projects, 3 images, 1 service, 1 step, 1 review");
client.close();
