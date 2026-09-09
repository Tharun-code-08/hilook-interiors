import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * The database handle.
 *
 * One driver covers both deployments, which is the reason libSQL was chosen
 * over plain better-sqlite3:
 *
 *   - Local / VPS  — TURSO_DATABASE_URL unset, so it opens data/hilook.db as a
 *                    file. No account, no network, no setup.
 *   - Serverless   — TURSO_DATABASE_URL set, so the same code talks to Turso
 *                    over HTTP and writes nothing to the filesystem.
 *
 * Nothing above this module needs to know which one is active.
 */

declare global {
  var __hilookDb: LibSQLDatabase<typeof schema> | undefined;
  var __hilookClient: Client | undefined;
}

export type DB = LibSQLDatabase<typeof schema>;

function createDb(): { db: DB; client: Client } {
  const url = process.env.TURSO_DATABASE_URL;

  const client = url
    ? createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
    : createClient({ url: localFileUrl() });

  if (isLocalFile(url)) tuneLocalFile(client);

  return { db: drizzle(client, { schema }), client };
}

function isLocalFile(url: string | undefined): boolean {
  return !url || url.startsWith("file:");
}

/**
 * SQLite's defaults are wrong for a web server.
 *
 * Out of the box a file database uses rollback-journal mode with a single
 * writer and no wait: a second concurrent write returns SQLITE_BUSY
 * immediately rather than queueing. Under a burst of admin saves that surfaces
 * as failed requests — writes aren't lost, but they don't land either.
 *
 * WAL lets readers proceed during a write, and busy_timeout makes a blocked
 * writer wait for the lock instead of giving up. Turso handles this server
 * side, so it only applies to the local-file driver.
 */
function tuneLocalFile(client: Client): void {
  // Executed one at a time, NOT via batch(): batch wraps its statements in a
  // transaction, and `PRAGMA journal_mode = WAL` cannot run inside one —
  // SQLite rejects it with "cannot change into wal mode from within a
  // transaction" and the whole batch, including the other pragmas, is lost.
  const pragmas = [
    "PRAGMA journal_mode = WAL",
    "PRAGMA busy_timeout = 5000",
    // Durable enough for this workload and markedly faster than FULL, which
    // fsyncs on every single commit.
    "PRAGMA synchronous = NORMAL",
    "PRAGMA foreign_keys = ON",
  ];

  void (async () => {
    for (const pragma of pragmas) {
      try {
        await client.execute(pragma);
      } catch (error) {
        console.warn(`[hilook] could not apply "${pragma}":`, error);
      }
    }
  })();
}

function localFileUrl(): string {
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[hilook] TURSO_DATABASE_URL is not set — falling back to a local SQLite file.\n" +
        "[hilook] On a serverless host that filesystem is ephemeral and read-only:\n" +
        "[hilook] writes will fail or silently vanish. Set TURSO_DATABASE_URL."
    );
  }
  // file: URLs need forward slashes even on Windows.
  const path = `${process.cwd().replace(/\\/g, "/")}/data/hilook.db`;
  return `file:${path}`;
}

/**
 * Cached on globalThis so Next's dev server doesn't open a new connection on
 * every hot reload — the same pattern the lowdb store used.
 */
export function getDb(): DB {
  if (!global.__hilookDb) {
    const { db, client } = createDb();
    global.__hilookDb = db;
    global.__hilookClient = client;
  }
  return global.__hilookDb;
}

/** Raw client, for migrations and health checks. */
export function getClient(): Client {
  if (!global.__hilookClient) getDb();
  return global.__hilookClient!;
}

/** True when running against Turso rather than a local file. */
export function isRemoteDatabase(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}
