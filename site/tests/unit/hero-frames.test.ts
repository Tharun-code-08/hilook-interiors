import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FRAME_COUNT } from "@/lib/frames.generated";
import {
  POSTER_FRAME_INDEX,
  POSTER_FRAME_SRC,
  backfillIndices,
  firstPassIndices,
  frameSrc,
} from "@/lib/hero-frames";

/**
 * Guards the hero against footage it does not have.
 *
 * public/frames held 360 JPEGs but public/hero.mp4 is 141 frames long: the
 * first build shipped an abstract placeholder video, and when the real
 * flythrough replaced it the extraction overwrote frame_0001..0141 and left
 * frame_0142..0360 behind. FRAME_COUNT was being derived from the directory,
 * so the scrub played 141 frames of house and then 219 frames of leftover
 * gradient — over the philosophy, process, and closing beats, i.e. most of
 * what a visitor actually reads.
 *
 * Nothing in the app fails when this happens. The frames exist, they load,
 * they paint; they are just not the film. So the check has to be here.
 */

const root = join(__dirname, "..", "..");
const framesDir = join(root, "public", "frames");
const videoFile = join(root, "public", "hero.mp4");

/**
 * Frame count from the MP4 container: `stsz` carries one entry per sample, and
 * one sample is one frame for a video track. Mirrors the parse in
 * scripts/generate-frame-manifest.mjs — deliberately re-implemented rather than
 * imported, so a bug in the generator cannot make this test agree with it.
 */
function frameCountFromVideo(path: string): number | null {
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  const at = buf.indexOf("stsz");
  if (at < 0) return null;
  const sampleCount = buf.readUInt32BE(at + 12);
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 100000) return null;
  return sampleCount;
}

describe("hero frame manifest", () => {
  it("never claims more frames than the source video has", () => {
    const fromVideo = frameCountFromVideo(videoFile);
    // Skip rather than fail if the video is absent — a checkout without the
    // media should not break the suite.
    if (fromVideo === null) return;

    expect(FRAME_COUNT).toBe(fromVideo);
  });

  it("has a real JPEG on disk for every frame it claims", () => {
    if (!existsSync(framesDir)) return;

    const missing: number[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const name = `frame_${String(i).padStart(4, "0")}.jpg`;
      if (!existsSync(join(framesDir, name))) missing.push(i);
    }

    expect(missing).toEqual([]);
  });

  it("does not serve frames that sit past the end of the video", () => {
    const fromVideo = frameCountFromVideo(videoFile);
    if (fromVideo === null || !existsSync(framesDir)) return;

    // Extra files on disk are tolerated (they are leftovers, and
    // scripts/prune-stale-frames.mjs removes them) — what must not happen is
    // the hero asking for one.
    const onDisk = readdirSync(framesDir).filter((n) => /^frame_\d{4}\.jpg$/.test(n)).length;
    if (onDisk > fromVideo) {
      expect(FRAME_COUNT).toBeLessThan(onDisk);
    }

    const requested = [...firstPassIndices(8), ...backfillIndices(8), POSTER_FRAME_INDEX];
    const highest = Math.max(...requested);
    expect(highest).toBeLessThanOrEqual(fromVideo - 1);
  });
});

describe("frame loading plan", () => {
  it("covers every frame exactly once across both passes", () => {
    for (const stride of [1, 4, 8, 12]) {
      const all = [...firstPassIndices(stride), ...backfillIndices(stride)].sort((a, b) => a - b);
      expect(new Set(all).size).toBe(FRAME_COUNT);
      expect(all[0]).toBe(0);
      expect(all[all.length - 1]).toBe(FRAME_COUNT - 1);
    }
  });

  it("keeps every index it hands out inside the sequence", () => {
    for (const stride of [1, 4, 8, 12]) {
      for (const i of [...firstPassIndices(stride), ...backfillIndices(stride)]) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(FRAME_COUNT);
      }
    }
  });
});

describe("poster frame", () => {
  it("points at a frame that exists", () => {
    expect(POSTER_FRAME_INDEX).toBeGreaterThanOrEqual(0);
    expect(POSTER_FRAME_INDEX).toBeLessThan(FRAME_COUNT);
    expect(POSTER_FRAME_SRC).toBe(frameSrc(POSTER_FRAME_INDEX, "w1920"));
  });

  it("is encoded on disk, since Open Graph and JSON-LD point external crawlers at it", () => {
    const variantFile = join(root, "public", "frames", "w1920", POSTER_FRAME_SRC.split("/").pop()!);
    if (!existsSync(join(root, "public", "frames", "w1920"))) return;
    expect(existsSync(variantFile)).toBe(true);
  });

  it("lands on the interior, not the opening exterior", () => {
    // The footage runs exterior approach → entrance → interior → exterior
    // reveal. A social card of a dark lawn is not what the studio sells.
    expect(POSTER_FRAME_INDEX / FRAME_COUNT).toBeGreaterThan(0.4);
    expect(POSTER_FRAME_INDEX / FRAME_COUNT).toBeLessThan(0.75);
  });
});
