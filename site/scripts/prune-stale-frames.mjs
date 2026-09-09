/**
 * Deletes hero frames that are past the end of public/hero.mp4.
 *
 * These accumulate when a shorter video replaces a longer one: the extraction
 * overwrites frame_0001..N and leaves everything above N behind. Those
 * leftovers are no longer served (the manifest counts from the video, not the
 * directory) but they still ship in the deployment.
 *
 * Prints what it would remove and exits, unless --apply is passed.
 *
 *   node scripts/prune-stale-frames.mjs          # dry run
 *   node scripts/prune-stale-frames.mjs --apply  # delete
 */
import { readdirSync, readFileSync, existsSync, unlinkSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const framesDir = join(root, "public", "frames");
const videoFile = join(root, "public", "hero.mp4");

/** Encoded variant directories written by scripts/encode-frames.mjs. */
const VARIANT_DIRS = ["w1920", "w960"];
const FRAME_RE = /^frame_(\d{4})\.jpg$/;

const apply = process.argv.includes("--apply");

/** See generate-frame-manifest.mjs — stsz sample_count is the frame count. */
function frameCountFromVideo(path) {
  let buf;
  try {
    buf = readFileSync(path);
  } catch {
    return null;
  }
  const at = buf.indexOf("stsz");
  if (at < 0) return null;
  const sampleCount = buf.readUInt32BE(at + 12);
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 100000) return null;
  return sampleCount;
}

const keep = frameCountFromVideo(videoFile);
if (keep === null) {
  console.error(
    "[prune] Could not read a frame count from public/hero.mp4 — refusing to delete anything."
  );
  process.exit(1);
}

const numbers = readdirSync(framesDir)
  .map((name) => FRAME_RE.exec(name))
  .filter((m) => m !== null)
  .map((m) => Number(m[1]))
  .sort((a, b) => a - b);

const stale = numbers.filter((n) => n > keep);

if (stale.length === 0) {
  console.log(`[prune] Nothing to do — ${numbers.length} frames on disk, video has ${keep}.`);
  process.exit(0);
}

const targets = [];
for (const n of stale) {
  const padded = String(n).padStart(4, "0");
  targets.push(join(framesDir, `frame_${padded}.jpg`));
  for (const dir of VARIANT_DIRS) {
    targets.push(join(framesDir, dir, `frame_${padded}.webp`));
  }
}

const existing = targets.filter((p) => existsSync(p));
const bytes = existing.reduce((sum, p) => sum + statSync(p).size, 0);
const mb = (bytes / 1024 / 1024).toFixed(1);

console.log(
  `[prune] Video has ${keep} frames; disk has ${numbers.length}.\n` +
    `[prune] Stale: frames ${stale[0]}–${stale[stale.length - 1]} ` +
    `(${existing.length} files across jpg + ${VARIANT_DIRS.join(" + ")}, ${mb}MB).`
);

if (!apply) {
  console.log("[prune] Dry run. Re-run with --apply to delete.");
  process.exit(0);
}

let removed = 0;
for (const path of existing) {
  unlinkSync(path);
  removed++;
}
console.log(`[prune] Removed ${removed} files (${mb}MB freed).`);
console.log(
  "[prune] The source JPEGs are tracked in git — `git checkout public/frames` restores them."
);
