import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * Spins up a throwaway database for a test file.
 *
 * lib/client.ts reads TURSO_DATABASE_URL, and libSQL accepts `file:` URLs
 * there as readily as remote ones — so pointing it at a temp file gives the
 * repositories a real database without any test-only branch in the source.
 *
 * Set up BEFORE importing anything that calls getDb(), since the connection is
 * cached on globalThis.
 */
export function createTestDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "hilook-test-"));
  const file = join(dir, "test.db").split("\\").join("/");
  const url = `file:${file}`;

  process.env.TURSO_DATABASE_URL = url;
  delete process.env.TURSO_AUTH_TOKEN;

  // Clear any connection a previous test file cached.
  const g = globalThis as { __hilookDb?: unknown; __hilookClient?: unknown };
  g.__hilookDb = undefined;
  g.__hilookClient = undefined;

  return {
    url,
    async migrate() {
      const client = createClient({ url });
      await migrate(drizzle(client), { migrationsFolder: "drizzle" });
      client.close();
    },
    cleanup() {
      const g2 = globalThis as { __hilookClient?: { close(): void } };
      try {
        g2.__hilookClient?.close();
      } catch {
        /* already closed */
      }
      delete process.env.TURSO_DATABASE_URL;
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* Windows sometimes holds the handle briefly; the temp dir is disposable */
      }
    },
  };
}
