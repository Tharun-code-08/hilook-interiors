import type { Config } from "drizzle-kit";

/**
 * drizzle-kit reads this to generate SQL migrations from lib/schema.ts.
 * Migrations are committed and applied by scripts/migrate.mjs at deploy time,
 * so production never runs schema generation.
 */
export default {
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:./data/hilook.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
