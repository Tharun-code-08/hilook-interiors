import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every server-rendered admin page checks the session itself.
 *
 * The check used to live only in app/admin/(dashboard)/layout.tsx. Next does
 * not re-render a shared layout on client-side navigation, and on a full load
 * it renders the layout and the page together — so a revoked session still
 * received page data: the navigation payload came back whole, and even the
 * redirect to sign-in carried the page's rows in its body. The fix is
 * requireAdmin() at the top of every page, before its first query.
 *
 * The e2e suite proves the fix on one page. This makes it true of all of them,
 * and fails the day a new page is added without it.
 */

const ROOT = join(process.cwd(), "app", "admin", "(dashboard)");

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pageFiles(path);
    return name === "page.tsx" ? [path] : [];
  });
}

// A client component page cannot load server data, so it has nothing to guard.
const serverPages = pageFiles(ROOT).filter(
  (path) => !/^\s*["']use client["']/.test(readFileSync(path, "utf8"))
);

describe("admin page authentication", () => {
  it("finds the admin pages", () => {
    // Guards the guard: a wrong path would make every case below vacuous.
    expect(serverPages.length).toBeGreaterThanOrEqual(12);
  });

  it.each(serverPages.map((path) => [relative(ROOT, path), path]))(
    "%s awaits requireAdmin() before anything else",
    (_name, path) => {
      const source = readFileSync(path, "utf8");
      const body = source.slice(source.indexOf("export default async function"));
      const firstAwait = /await\s+([\w.]+)\s*\(/.exec(body);
      expect(firstAwait?.[1]).toBe("requireAdmin");
    }
  );
});
