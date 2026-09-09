import { FRAME_COUNT } from "./frames.generated";

/**
 * Runtime policy for how much hero footage to fetch.
 *
 * The original loader built every Image object in one synchronous loop —
 * roughly 25MB of JPEG requested before the fold had rendered (finding C4).
 * Nothing about that adapted to viewport, connection, or data-saver.
 *
 * Two dials replace it:
 *
 *   variant — which encoded width to pull from (w960 / w1920).
 *   stride  — how many frames to *skip* on the first pass. A stride of 8
 *             fetches 18 of the 141 frames, so the scrub is responsive almost
 *             immediately; the gaps are backfilled at idle afterwards.
 *
 * Nearest-loaded-frame painting (see ScrollHero) is what makes a stride
 * viable: at stride 8 the canvas shows a frame at most 4 positions from the
 * one the scroll wants, which reads as a slightly coarse scrub rather than a
 * stall — and it sharpens as the backfill lands.
 */

export type FramePlan = {
  variant: "w960" | "w1920";
  /** Initial sampling interval. 1 = fetch every frame up front. */
  stride: number;
  /** Whether to backfill the skipped frames once the first pass is done. */
  backfill: boolean;
  /** Skip the sequence entirely and show one still. */
  staticOnly: boolean;
};

type ConnectionLike = {
  saveData?: boolean;
  effectiveType?: string;
};

export function planFrameLoading(): FramePlan {
  // SSR and any environment without the APIs: assume a capable desktop, since
  // the effect only runs client-side anyway.
  if (typeof window === "undefined") {
    return { variant: "w1920", stride: 4, backfill: true, staticOnly: false };
  }

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // A 500vh scroll-jacked canvas is a vestibular hazard, and it is also the
  // single most expensive thing on the page. Honouring the preference fixes
  // an accessibility failure and a performance one with the same branch.
  if (prefersReducedMotion) {
    return { variant: "w960", stride: 1, backfill: false, staticOnly: true };
  }

  const connection = (navigator as Navigator & { connection?: ConnectionLike }).connection;

  if (connection?.saveData) {
    // Data-saver is an explicit request; treat it as binding, not advisory.
    return { variant: "w960", stride: 1, backfill: false, staticOnly: true };
  }

  const effectiveType = connection?.effectiveType ?? "4g";
  if (effectiveType === "slow-2g" || effectiveType === "2g") {
    return { variant: "w960", stride: 1, backfill: false, staticOnly: true };
  }
  if (effectiveType === "3g") {
    return { variant: "w960", stride: 12, backfill: false, staticOnly: false };
  }

  // Device pixels, not CSS pixels: a 1x 1400px display needs fewer bytes than
  // a 2x 800px phone, and the canvas cover-fits either way.
  const devicePixelWidth = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
  const variant: FramePlan["variant"] = devicePixelWidth > 1100 ? "w1920" : "w960";

  return { variant, stride: 8, backfill: true, staticOnly: false };
}

/** URL for one frame. `index` is 0-based; files on disk are 1-based. */
export function frameSrc(index: number, variant: FramePlan["variant"]): string {
  const n = String(index + 1).padStart(4, "0");
  return `/frames/${variant}/frame_${n}.webp`;
}

/**
 * The frame shown for the reduced-motion / data-saver path, and as the hero's
 * poster before the sequence is ready.
 *
 * The sequence runs exterior approach → entrance → interior → exterior reveal.
 * The poster wants the interior beat: it is what the studio actually sells,
 * and the opening frames are a dark exterior that reads as an empty page.
 * That beat sits a little past the midpoint, hence 0.55 rather than a
 * round fraction — it is a position in the shot, not an arbitrary sample.
 */
export const POSTER_FRAME_INDEX = Math.floor(FRAME_COUNT * 0.55);

/**
 * The same frame as a path, for Open Graph, Twitter, and JSON-LD.
 *
 * These used to hardcode /frames/w1920/frame_0090.webp. That is a frame number
 * with no relationship to the footage: swap in a shorter video and the social
 * card silently 404s, which nobody notices because it only renders on someone
 * else's site. Deriving it from FRAME_COUNT means it always points at a frame
 * that exists.
 */
export const POSTER_FRAME_SRC = frameSrc(POSTER_FRAME_INDEX, "w1920");

/** Indices to fetch on the first pass, always including first and last. */
export function firstPassIndices(stride: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < FRAME_COUNT; i += stride) indices.push(i);
  if (indices[indices.length - 1] !== FRAME_COUNT - 1) indices.push(FRAME_COUNT - 1);
  return indices;
}

/** Everything the first pass skipped, ordered so the sequence sharpens evenly. */
export function backfillIndices(stride: number): number[] {
  if (stride <= 1) return [];

  const first = new Set(firstPassIndices(stride));
  const remaining: number[] = [];

  // Halving passes: fill the midpoints, then the midpoints of those, so the
  // effective resolution doubles with each pass instead of sharpening the
  // opening while the end is still coarse.
  for (let gap = Math.floor(stride / 2); gap >= 1; gap = Math.floor(gap / 2)) {
    for (let i = gap; i < FRAME_COUNT; i += Math.max(1, gap * 2)) {
      if (!first.has(i) && !remaining.includes(i)) remaining.push(i);
    }
    if (gap === 1) break;
  }

  for (let i = 0; i < FRAME_COUNT; i++) {
    if (!first.has(i) && !remaining.includes(i)) remaining.push(i);
  }

  return remaining;
}
