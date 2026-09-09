/**
 * Clears .next when it holds the leftovers of a production build.
 *
 * `next build` and `next dev` both own .next and put different things in it.
 * Start the dev server on top of a production build and the directory ends up
 * holding both, at which point Next reports errors describing a project you do
 * not have. The one that prompted this said:
 *
 *   You're importing a component that needs "server-only". That only works in
 *   a Server Component which is not supported in the pages/ directory
 *
 * There is no pages/ directory here, and nothing was wrong with the code — the
 * build output was mixed. `rm -rf .next` fixed it, but only after the message
 * had been taken at face value for a while, which is the cost this avoids.
 *
 * Runs from predev, so it clears the build *before* dev can layer onto it.
 * Once the two are mixed the evidence is already gone: `next dev` overwrites
 * some of the build's files, so afterwards there is nothing reliable left to
 * detect. Prevention is the only workable point.
 */
import { existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const next = join(root, ".next");

if (!existsSync(next)) process.exit(0);

/**
 * Written by `next build` and never by `next dev`.
 *
 * Verified by building and dev-running into separate directories and diffing
 * them, because the obvious candidate is wrong: prerender-manifest.json looks
 * like a build artifact and is written by both. Using it here deleted the dev
 * cache on every start.
 */
const BUILD_ONLY = ["BUILD_ID", "required-server-files.json"];

if (BUILD_ONLY.some((name) => existsSync(join(next, name)))) {
  rmSync(next, { recursive: true, force: true });
  console.log("[clean] Cleared a production .next so the dev server starts from its own.");
}
