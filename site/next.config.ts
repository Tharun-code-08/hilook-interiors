import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Build output directory, overridable per-invocation.
   *
   * A production build and a running `next dev` both own .next, so auditing or
   * e2e-testing a build while the dev server is up leaves each clobbering the
   * other — the symptom is a "500: Internal Server Error" shell from a server
   * that started fine. Pointing the audit at its own directory keeps the two
   * out of each other's way. Unset in normal use, so the default is unchanged.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  images: {
    // AVIF first, WebP as the fallback. Unlike the hero sequence — where
    // per-frame decode speed rules and WebP wins — these are single static
    // images, so the smaller format is the right trade.
    formats: ["image/avif", "image/webp"],

    // Portfolio images are shown as 4:5 cards in an auto-fit grid and as
    // 16:9 in the lightbox; these cover both without generating dead sizes.
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [256, 384, 512],

    // Uploads are served from this origin today. Phase 2 moves them to object
    // storage, at which point that bucket's hostname goes in remotePatterns.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  // Strips the "x-powered-by: Next.js" version disclosure.
  poweredByHeader: false,
};

export default nextConfig;
