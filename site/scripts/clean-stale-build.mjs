/**
 * Housekeeping for build output, run from predev.
 *
 * Two problems, both caused by the same thing: `next build` and `next dev`
 * share .next, and tooling here builds into throwaway directories via
 * NEXT_DIST_DIR.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Clears .next when it holds the leftovers of a production build.
 *
 * Start the dev server on top of a production build and the directory ends up
 * holding both, and Next then reports errors describing a project that does
 * not exist. The one that prompted this said:
 *
 *   You're importing a component that needs "server-only". That only works in
 *   a Server Component which is not supported in the pages/ directory
 *
 * There is no pages/ directory here, and nothing was wrong with the code — the
 * build output was mixed. `rm -rf .next` fixed it, but only after the message
 * had been taken at face value for a while, which is the cost this avoids.
 *
 * This has to run *before* the dev server starts rather than detect the
 * mixture afterwards: once the two are layered, `next dev` has overwritten
 * enough of the build that there is nothing dependable left to detect.
 */
function clearStaleProductionBuild() {
  const next = join(root, ".next");
  if (!existsSync(next)) return;

  // Written by `next build` and never by `next dev`. Verified by building and
  // dev-running into separate directories and diffing them, because the
  // obvious candidate is wrong: prerender-manifest.json reads like a build
  // artifact and is written by both, and using it deleted the dev cache on
  // every start.
  const buildOnly = ["BUILD_ID", "required-server-files.json"];

  if (buildOnly.some((name) => existsSync(join(next, name)))) {
    rmSync(next, { recursive: true, force: true });
    console.log("[clean] Cleared a production .next so the dev server starts from its own.");
  }
}

/**
 * Drops tsconfig "include" entries left behind by throwaway build directories.
 *
 * Next appends an entry for its own distDir's generated types on every build,
 * so each throwaway NEXT_DIST_DIR used for an audit or a test run leaves one
 * behind permanently. Eleven accumulated across a single session and were
 * committed.
 *
 * They are not inert. tsc reports TS6053, "file not found", for every entry
 * whose directory has since been deleted, which reads like a broken project
 * and sent one debugging session down the wrong path already.
 *
 * Only entries beginning ".next-" are removed; the real ".next" one stays.
 */
function pruneStaleTsconfigIncludes() {
  const tsconfigPath = join(root, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return;

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(tsconfigPath, "utf8"));
  } catch {
    // Comments or trailing commas: leave a file that cannot be safely rewritten.
    return;
  }

  if (!Array.isArray(parsed.include)) return;

  const kept = parsed.include.filter(
    (entry) => !(typeof entry === "string" && entry.startsWith(".next-"))
  );
  const dropped = parsed.include.length - kept.length;
  if (dropped === 0) return;

  parsed.include = kept;
  writeFileSync(tsconfigPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log(
    `[clean] Removed ${dropped} stale build ${dropped === 1 ? "directory" : "directories"} from tsconfig include.`
  );
}

clearStaleProductionBuild();
pruneStaleTsconfigIncludes();
