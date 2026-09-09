/**
 * Generates lib/frames.generated.ts.
 *
 * The count comes from public/hero.mp4 — the video the frames are extracted
 * from — and public/frames is then checked against it.
 *
 * Deriving the count from the *directory* is what put 219 frames of abstract
 * placeholder art into the hero. The first build shipped a locally-generated
 * abstract placeholder video; when the real 141-frame flythrough replaced it,
 * the extraction overwrote frame_0001..0141 but left frame_0142..0360 from the
 * old placeholder sitting on disk. A directory-derived count read 360, so the
 * scrub played 141 frames of real footage and then 219 frames of leftover
 * gradients — from ~39% of the scroll onward, which is where the PHILOSOPHY,
 * PROCESS and closing beats all land.
 *
 * The video knows how many frames it has. The directory only knows what was
 * never cleaned up. So the video wins, and a mismatch is reported rather than
 * silently believed.
 *
 * Runs from predev + prebuild. Safe to run by hand: `npm run frames:manifest`.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const framesDir = join(root, "public", "frames");
const videoFile = join(root, "public", "hero.mp4");
const outFile = join(root, "lib", "frames.generated.ts");

/** frame_0001.jpg .. frame_NNNN.jpg — anything else in the directory is ignored. */
const FRAME_RE = /^frame_(\d{4})\.jpg$/;

/**
 * Frame count straight out of the MP4 container.
 *
 * `stsz` (sample size box) carries one entry per sample, and for a video track
 * one sample is one frame, so its sample_count field is the frame count. Read
 * directly rather than shelling out to ffprobe: this runs on every dev and
 * build, and ffmpeg is not a dependency of this project.
 *
 * Returns null if the file isn't there or doesn't parse — callers fall back to
 * the directory rather than failing a build over a heuristic.
 */
function frameCountFromVideo(path) {
  let buf;
  try {
    buf = readFileSync(path);
  } catch {
    return null;
  }

  // The first stsz belongs to the first track. These exports are video-first,
  // and the audio track (if any) would carry a wildly different sample count,
  // so a sanity range keeps a mis-parse from being taken seriously.
  const at = buf.indexOf("stsz");
  if (at < 0) return null;

  // stsz layout after the type: version+flags (4), sample_size (4), sample_count (4)
  const sampleCount = buf.readUInt32BE(at + 12);
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 100000) {
    return null;
  }
  return sampleCount;
}

let entries;
try {
  entries = readdirSync(framesDir);
} catch {
  console.error(
    `[frames] public/frames is missing. Extract the hero frames first:\n` +
      `  ffmpeg -i public/hero.mp4 -vf "fps=24,scale=1920:-1" -q:v 3 "public/frames/frame_%04d.jpg"`
  );
  process.exit(1);
}

const numbers = entries
  .map((name) => FRAME_RE.exec(name))
  .filter((m) => m !== null)
  .map((m) => Number(m[1]))
  .sort((a, b) => a - b);

if (numbers.length === 0) {
  console.error("[frames] No frame_NNNN.jpg files found in public/frames.");
  process.exit(1);
}

const onDisk = numbers.length;
const fromVideo = frameCountFromVideo(videoFile);

// The video is authoritative when it parses; extra files on disk are treated as
// leftovers, not footage.
const count = fromVideo ?? onDisk;

if (fromVideo === null) {
  console.warn(
    `[frames] Could not read a frame count from public/hero.mp4 — falling back to\n` +
      `[frames] the ${onDisk} file(s) in public/frames. Verify the hero visually.`
  );
} else if (onDisk > fromVideo) {
  const stale = numbers.filter((n) => n > fromVideo);
  console.warn(
    `[frames] public/frames holds ${onDisk} frames but public/hero.mp4 has only ${fromVideo}.\n` +
      `[frames] Using ${fromVideo}. Frames ${stale[0]}–${stale[stale.length - 1]} are left over from a\n` +
      `[frames] previous extraction and are no longer served. To remove them:\n` +
      `[frames]   node scripts/prune-stale-frames.mjs`
  );
} else if (onDisk < fromVideo) {
  // Genuinely missing footage: the hero would request URLs that 404.
  console.error(
    `[frames] public/hero.mp4 has ${fromVideo} frames but only ${onDisk} are extracted.\n` +
      `[frames] Re-run the extraction:\n` +
      `  ffmpeg -i public/hero.mp4 -vf "fps=24,scale=1920:-1" -q:v 3 "public/frames/frame_%04d.jpg"`
  );
  process.exit(1);
}

// The hero indexes frames contiguously from 1. A gap inside the range we
// actually serve would make it request a URL that 404s and stall on that frame,
// so fail loudly rather than generate a count that lies about what is fetchable.
const present = new Set(numbers);
const gaps = [];
for (let expected = 1; expected <= count; expected++) {
  if (!present.has(expected)) gaps.push(expected);
}
if (gaps.length > 0) {
  const shown = gaps.slice(0, 10).join(", ");
  console.error(
    `[frames] Frame sequence has ${gaps.length} gap(s): ${shown}${gaps.length > 10 ? ", ..." : ""}\n` +
      `[frames] Frames must run contiguously from frame_0001.jpg.`
  );
  process.exit(1);
}

const contents = `// GENERATED FILE — do not edit by hand.
// Written by scripts/generate-frame-manifest.mjs on predev/prebuild.
// Derived from the frame count of public/hero.mp4.

/** Number of hero frames available at /frames/frame_%04d.jpg (1-indexed). */
export const FRAME_COUNT = ${count};
`;

// Only rewrite when the value actually changed, so we don't churn mtimes and
// trigger a needless dev-server recompile on every start.
let previous = null;
try {
  previous = readFileSync(outFile, "utf8");
} catch {
  /* first run */
}

if (previous !== contents) {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, contents, "utf8");
  console.log(`[frames] FRAME_COUNT = ${count} (updated lib/frames.generated.ts)`);
} else {
  console.log(`[frames] FRAME_COUNT = ${count} (unchanged)`);
}
