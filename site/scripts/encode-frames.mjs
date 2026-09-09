/**
 * Re-encodes public/frames/*.jpg into responsive WebP variants.
 *
 * The hero shipped its JPEGs at ~25MB total, all fetched eagerly on mount
 * (finding C4). That is the entire page budget spent before the fold renders,
 * and it lands hardest on the phones most likely to bounce.
 *
 * Note this encodes whatever JPEGs are in public/frames, which may include
 * frames past the end of hero.mp4 left over from an earlier extraction. Those
 * are never served — see scripts/prune-stale-frames.mjs.
 *
 * Why WebP and not AVIF: measured on this footage, AVIF at comparable quality
 * came out *larger* than WebP (14.5KB vs 13.1KB at 1920px) and takes longer to
 * decode. For a scrubbing sequence, per-frame decode time is the binding
 * constraint — the canvas has ~16ms to paint — so the format that decodes
 * fastest wins even where its files are marginally bigger.
 *
 * Run: npm run frames:encode
 * Idempotent — skips variants already present and newer than their source.
 */
import { readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const framesDir = join(root, "public", "frames");

/** Widths the hero picks between at runtime, by viewport and connection. */
const VARIANTS = [
  { dir: "w1920", width: 1920, quality: 70 },
  { dir: "w960", width: 960, quality: 74 },
];

const FRAME_RE = /^frame_(\d{4})\.jpg$/;
const force = process.argv.includes("--force");

const sources = readdirSync(framesDir)
  .filter((name) => FRAME_RE.test(name))
  .sort();

if (sources.length === 0) {
  console.error("[frames] No source JPEGs in public/frames.");
  process.exit(1);
}

for (const variant of VARIANTS) {
  mkdirSync(join(framesDir, variant.dir), { recursive: true });
}

console.log(`[frames] Encoding ${sources.length} frames into ${VARIANTS.length} variants…`);

const totals = Object.fromEntries(VARIANTS.map((v) => [v.dir, 0]));
let sourceBytes = 0;
let encoded = 0;
let skipped = 0;

for (const name of sources) {
  const srcPath = join(framesDir, name);
  sourceBytes += statSync(srcPath).size;

  for (const variant of VARIANTS) {
    const outName = name.replace(/\.jpg$/, ".webp");
    const outPath = join(framesDir, variant.dir, outName);

    if (!force && existsSync(outPath) && statSync(outPath).mtimeMs >= statSync(srcPath).mtimeMs) {
      totals[variant.dir] += statSync(outPath).size;
      skipped++;
      continue;
    }

    const buffer = await sharp(srcPath)
      .resize(variant.width, null, { withoutEnlargement: true })
      // effort 4 is the knee of the size/time curve here; 6 costs ~3x the time
      // for under 2% additional saving on this footage.
      .webp({ quality: variant.quality, effort: 4 })
      .toBuffer();

    const { writeFileSync } = await import("node:fs");
    writeFileSync(outPath, buffer);
    totals[variant.dir] += buffer.length;
    encoded++;
  }
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + "MB";

console.log(`[frames] Encoded ${encoded}, skipped ${skipped} (already current).`);
console.log(`[frames] Source JPEG set : ${mb(sourceBytes)}`);
for (const variant of VARIANTS) {
  const saving = Math.round((1 - totals[variant.dir] / sourceBytes) * 100);
  console.log(
    `[frames] ${variant.dir.padEnd(6)} WebP set: ${mb(totals[variant.dir])}  (−${saving}%)`
  );
}
