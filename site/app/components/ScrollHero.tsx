"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

/**
 * FRAME_COUNT must exactly match the number of files actually extracted
 * into public/frames (counted on disk after ffmpeg extraction, not
 * ffprobe's nb_frames estimate). Current source: the client-provided
 * cinematic house flythrough (5.875s at 24fps), extracted with
 * `ffmpeg -i hero.mp4 -vf "fps=24,scale=1920:-1" ...` — 141 frames,
 * frame_0001.jpg .. frame_0141.jpg.
 */
const FRAME_COUNT = 141;
const FALLBACK_BG = "#F4F1EA";
const EASE = [0.16, 1, 0.3, 1] as const;

function frameSrc(index: number) {
  const n = String(index + 1).padStart(4, "0");
  return `/frames/frame_${n}.jpg`;
}

export default function ScrollHero({
  heroLabel,
  heroTitle,
  heroParagraph,
  heroCta,
  philosophyLabel,
  philosophyText,
  processLabel,
  processText,
  closingLabel,
  closingTitle,
  closingCta,
}: {
  heroLabel: string;
  heroTitle: string;
  heroParagraph: string;
  heroCta: string;
  philosophyLabel: string;
  philosophyText: string;
  processLabel: string;
  processText: string;
  closingLabel: string;
  closingTitle: string;
  closingCta: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Single scroll-progress source of truth (rAF-driven, no scroll listener).
  // The canvas frame index AND every scroll-driven text transform below
  // read from this same motion value.
  const progress = useMotionValue(0);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const containerEl = containerRef.current;
    if (!canvasEl || !containerEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const size = { cw: 0, ch: 0 };
    const images: HTMLImageElement[] = [];
    const loaded: boolean[] = new Array(FRAME_COUNT).fill(false);

    // currentFrameRef: last frame index that was ACTUALLY painted (a real
    // loaded image, not the fallback). wantedFrameRef: the frame index the
    // scroll position currently wants. The two are allowed to diverge while
    // an image is still loading — the tracker only advances once a real
    // paint succeeds, so we never flash back to a blank/fallback frame.
    let currentFrame = 0;
    let wantedFrame = 0;
    let rafId = 0;

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      canvasEl!.width = Math.round(cw * dpr);
      canvasEl!.height = Math.round(ch * dpr);
      canvasEl!.style.width = `${cw}px`;
      canvasEl!.style.height = `${ch}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.cw = cw;
      size.ch = ch;
    }

    // Cover-fit draw. Returns true only when a fully-loaded image was
    // actually painted; false when only the cream fallback was painted.
    function drawFrame(index: number): boolean {
      ctx!.fillStyle = FALLBACK_BG;
      ctx!.fillRect(0, 0, size.cw, size.ch);

      const img = images[index];
      if (!img || !loaded[index] || !img.naturalWidth || !img.naturalHeight) {
        return false;
      }

      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max(size.cw / iw, size.ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (size.cw - dw) / 2;
      const dy = (size.ch - dh) / 2;
      ctx!.drawImage(img, dx, dy, dw, dh);
      return true;
    }

    resizeCanvas();

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        loaded[i] = true;
        if (wantedFrame === i) {
          const painted = drawFrame(i);
          if (painted) currentFrame = i;
        }
      };
      img.src = frameSrc(i);
      images.push(img);
    }

    function computeProgress() {
      const rect = containerEl!.getBoundingClientRect();
      const total = containerEl!.offsetHeight - window.innerHeight;
      if (total <= 0) return 0;
      const raw = -rect.top / total;
      return Math.max(0, Math.min(1, raw));
    }

    function tick() {
      const p = computeProgress();
      progress.set(p);

      const target = Math.round(p * (FRAME_COUNT - 1));
      wantedFrame = target;

      if (target !== currentFrame) {
        const painted = drawFrame(target);
        if (painted) currentFrame = target;
      }

      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    function onResize() {
      resizeCanvas();
      drawFrame(currentFrame);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, [progress]);

  // ---- Scroll-driven overlay transforms (all derived from `progress`) ----

  const identityOpacity = useTransform(progress, [0, 0.14], [1, 0]);
  const identityY = useTransform(progress, [0, 0.14], [0, -24]);

  const rightOpacity = useTransform(progress, [0.18, 0.24, 0.5, 0.56], [0, 1, 1, 0]);
  const rightX = useTransform(progress, [0.18, 0.24, 0.5, 0.56], [40, 0, 0, 22]);
  const rightY = useTransform(progress, [0.18, 0.24, 0.5, 0.56], [0, 0, 0, -14]);

  const leftOpacity = useTransform(progress, [0.54, 0.6, 0.82, 0.88], [0, 1, 1, 0]);
  const leftX = useTransform(progress, [0.54, 0.6, 0.82, 0.88], [-40, 0, 0, -22]);
  const leftY = useTransform(progress, [0.54, 0.6, 0.82, 0.88], [0, 0, 0, -14]);

  const backdropOpacity = useTransform(progress, [0.86, 0.96], [0, 1]);
  const closingOpacity = useTransform(progress, [0.88, 0.96], [0, 1]);
  const closingY = useTransform(progress, [0.88, 0.96], [36, 0]);

  return (
    <div ref={containerRef} style={{ height: "500vh", position: "relative" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: FALLBACK_BG,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />

        {/* Overlay: never gated behind an image-loading/ready flag. Each
           text block's visibility is controlled only by its own
           scroll-progress-driven opacity below. */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {/* Warm cinematic gradient behind the initial identity text */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(32,25,18,0.68) 0%, rgba(32,25,18,0.20) 45%, transparent 100%)",
            }}
          />

          {/* Beat 1 — identity block */}
          <motion.div
            style={{
              opacity: identityOpacity,
              y: identityY,
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "0 clamp(1.25rem, 6vw, 5rem) clamp(3rem, 8vh, 6rem)",
              maxWidth: 720,
            }}
          >
            <motion.p
              className="hi-label"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.05, ease: EASE }}
              style={{ color: "#C5A45E", marginBottom: "1.1rem" }}
            >
              {heroLabel}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 56 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.3, delay: 0.2, ease: EASE }}
              style={{
                fontFamily: "var(--font-playfair)",
                fontWeight: 400,
                fontSize: "clamp(2.2rem, 5.4vw, 4.4rem)",
                color: "#F8F2E8",
                lineHeight: 1.08,
                maxWidth: "14ch",
                marginBottom: "1.4rem",
              }}
            >
              {heroTitle}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.4, ease: EASE }}
              style={{
                fontFamily: "var(--font-inter)",
                fontWeight: 300,
                fontSize: "1.05rem",
                color: "rgba(248,242,232,0.86)",
                maxWidth: "42ch",
                marginBottom: "2rem",
              }}
            >
              {heroParagraph}
            </motion.p>

            <motion.a
              href="#portfolio"
              className="hi-cta"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.55, ease: EASE }}
              style={{ pointerEvents: "auto" }}
            >
              {heroCta}
            </motion.a>
          </motion.div>

          {/* Beat 2 — right-side atmospheric paragraph */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              left: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "0 clamp(1.25rem, 6vw, 5rem)",
            }}
          >
            <motion.div
              style={{
                opacity: rightOpacity,
                x: rightX,
                y: rightY,
                maxWidth: "min(380px, 100%)",
                textAlign: "right",
              }}
            >
              <p className="hi-label" style={{ color: "#C5A45E", marginBottom: "0.9rem" }}>
                {philosophyLabel}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontWeight: 400,
                  fontSize: "clamp(1.3rem, 2.2vw, 1.7rem)",
                  color: "#F8F2E8",
                  lineHeight: 1.4,
                }}
              >
                {philosophyText}
              </p>
            </motion.div>
          </div>

          {/* Beat 3 — left-side process paragraph */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              left: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              padding: "0 clamp(1.25rem, 6vw, 5rem)",
            }}
          >
            <motion.div
              style={{
                opacity: leftOpacity,
                x: leftX,
                y: leftY,
                maxWidth: "min(380px, 100%)",
                textAlign: "left",
              }}
            >
              <p className="hi-label" style={{ color: "#C5A45E", marginBottom: "0.9rem" }}>
                {processLabel}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontWeight: 400,
                  fontSize: "clamp(1.3rem, 2.2vw, 1.7rem)",
                  color: "#F8F2E8",
                  lineHeight: 1.4,
                }}
              >
                {processText}
              </p>
            </motion.div>
          </div>

          {/* Beat 4 — closing center title + CTA (holds at full opacity) */}
          <motion.div
            style={{
              opacity: backdropOpacity,
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, rgba(32,25,18,0.6) 0%, rgba(32,25,18,0.25) 50%, transparent 78%)",
            }}
          />
          <motion.div
            style={{
              opacity: closingOpacity,
              y: closingY,
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 1.5rem",
            }}
          >
            <p className="hi-label" style={{ color: "#C5A45E", marginBottom: "1.2rem" }}>
              {closingLabel}
            </p>
            <h2
              style={{
                fontFamily: "var(--font-playfair)",
                fontWeight: 400,
                fontSize: "clamp(2.4rem, 6vw, 5.2rem)",
                color: "#F8F2E8",
                maxWidth: "18ch",
                lineHeight: 1.1,
                marginBottom: "2rem",
              }}
            >
              {closingTitle}
            </h2>
            <motion.a
              href="#contact"
              className="hi-cta"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              style={{ pointerEvents: "auto" }}
            >
              {closingCta}
            </motion.a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
