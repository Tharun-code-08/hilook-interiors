import "server-only";
import { getDb } from "../client";
import * as t from "../schema";
import { DEFAULT_SETTINGS, type Settings } from "../types";

/**
 * Settings, stored as key/value rows.
 *
 * Not one wide row and not a JSON blob: both would require reading the whole
 * object, mutating it, and writing it back — exactly the read-modify-write
 * that made concurrent saves lose each other in the JSON store. Per-key rows
 * mean a settings save touches only the keys that actually changed, and two
 * editors changing different fields can't clobber one another.
 */

export async function getSettings(): Promise<Settings> {
  const rows = await getDb().select().from(t.settings);

  // Merged over defaults, so a key that has never been written (a newly added
  // setting, a fresh install) resolves without a data migration.
  const stored: Record<string, string> = {};
  for (const row of rows) stored[row.key] = row.value;

  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

/**
 * Writes only the keys whose value actually differs.
 *
 * Returns the keys that changed, which the audit log records — "updated
 * settings" is much less useful than "updated contactEmail, instagramUrl".
 */
export async function updateSettings(patch: Partial<Settings>): Promise<{
  settings: Settings;
  changed: string[];
}> {
  const db = getDb();
  const current = await getSettings();

  const changed: string[] = [];
  const writes: { key: string; value: string }[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (typeof value !== "string") continue;
    // Only accept keys the Settings type actually declares — the API schema
    // has a catchall, so without this an arbitrary key could be persisted and
    // then served on every page render.
    if (!(key in DEFAULT_SETTINGS)) continue;
    if (current[key as keyof Settings] === value) continue;

    changed.push(key);
    writes.push({ key, value });
  }

  if (writes.length > 0) {
    // A batch, not an interactive transaction. These are independent upserts,
    // and batch is atomic without holding a transaction open across round
    // trips — which matters because two operators saving different settings
    // at once would otherwise contend for the write lock and one would fail
    // with SQLITE_BUSY.
    const statements = writes.map((row) =>
      db
        .insert(t.settings)
        .values(row)
        .onConflictDoUpdate({ target: t.settings.key, set: { value: row.value } })
    );

    // batch() is typed as a non-empty tuple; `writes.length > 0` above is the
    // guarantee TypeScript can't derive from Array.prototype.map.
    await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  }

  return {
    settings: {
      ...current,
      ...Object.fromEntries(writes.map((w) => [w.key, w.value])),
    } as Settings,
    changed,
  };
}
