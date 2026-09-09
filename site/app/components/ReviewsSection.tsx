"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Reveal from "./Reveal";
import type { Review } from "@/lib/types";

/**
 * Client testimonials.
 *
 * Two things were wrong. Visually, this sat on oxblood (#5A2630) directly
 * after the forest-green process section — two heavily saturated darks back
 * to back, in hues that fight rather than sequence, which made the lower half
 * of the page feel like unrelated blocks stacked up. Process is now the only
 * dark moment before the footer, and this reads as a quiet light interval.
 *
 * Structurally, the quote was set at body scale with a row of gold stars on
 * top. For a design studio the testimonial itself is the asset: it gets the
 * display face at pull-quote size, and the rating drops to a restrained mark
 * beside the attribution instead of leading.
 */

function Rating({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span
      // One accessible string rather than five glyphs a screen reader would
      // read out individually.
      role="img"
      aria-label={`Rated ${rounded} out of 5`}
      style={{ display: "inline-flex", gap: 2, color: "var(--hi-accent)", fontSize: "0.7rem" }}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} aria-hidden style={{ opacity: i < rounded ? 1 : 0.22 }}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ReviewsSection({ reviews, label }: { reviews: Review[]; label: string }) {
  const approved = [...reviews]
    .filter((r) => r.approved)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.order - b.order);

  const [index, setIndex] = useState(0);

  if (approved.length === 0) return null;

  const current = approved[index % approved.length];
  const multiple = approved.length > 1;

  function go(next: number) {
    setIndex((next + approved.length) % approved.length);
  }

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      aria-roledescription="carousel"
      style={{
        padding: "clamp(5rem, 13vh, 9rem) 0",
        background: "var(--hi-surface-alt)",
        borderTop: "1px solid var(--hi-rule)",
      }}
      onKeyDown={(e) => {
        if (!multiple) return;
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div className="hi-container" style={{ maxWidth: 900 }}>
        <Reveal>
          <p className="hi-label" id="reviews-heading">
            {label}
          </p>
        </Reveal>

        <div style={{ marginTop: "clamp(2rem, 5vh, 3rem)", minHeight: 240 }}>
          <AnimatePresence mode="wait">
            <motion.figure
              key={current.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{ margin: 0 }}
              aria-live="polite"
            >
              <blockquote
                style={{
                  margin: 0,
                  fontFamily: "var(--font-playfair)",
                  fontWeight: 400,
                  fontSize: "clamp(1.45rem, 3.1vw, 2.35rem)",
                  lineHeight: 1.42,
                  letterSpacing: "-0.01em",
                  color: "var(--hi-ink)",
                  textWrap: "pretty",
                }}
              >
                &ldquo;{current.text}&rdquo;
              </blockquote>

              <figcaption
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.9rem",
                  marginTop: "clamp(1.75rem, 4vh, 2.5rem)",
                  paddingTop: "1.5rem",
                  borderTop: "1px solid var(--hi-rule)",
                }}
              >
                {current.photo && (
                  <span
                    style={{
                      position: "relative",
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "var(--hi-rule)",
                    }}
                  >
                    <Image
                      src={current.photo}
                      alt=""
                      aria-hidden="true"
                      fill
                      sizes="44px"
                      style={{ objectFit: "cover" }}
                    />
                  </span>
                )}
                <span style={{ display: "grid", gap: "0.25rem" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: "0.88rem",
                      letterSpacing: "0.03em",
                      color: "var(--hi-ink)",
                    }}
                  >
                    {current.name}
                  </span>
                  <Rating value={current.rating} />
                </span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        {multiple && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginTop: "2rem",
            }}
          >
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous review"
              className="hi-review-nav hi-focusable"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next review"
              className="hi-review-nav hi-focusable"
            >
              ›
            </button>

            <span
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "0.75rem",
                letterSpacing: "0.14em",
                color: "var(--hi-ink-soft)",
                fontVariantNumeric: "tabular-nums",
                marginLeft: "0.25rem",
              }}
            >
              {String(index + 1).padStart(2, "0")} / {String(approved.length).padStart(2, "0")}
            </span>
          </div>
        )}
      </div>

      <style>{`
        .hi-review-nav {
          width: 44px;
          height: 44px;
          border: 1px solid var(--hi-rule-strong);
          border-radius: 50%;
          background: transparent;
          color: var(--hi-ink);
          font-size: 1.3rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition:
            border-color var(--hi-dur) var(--hi-ease),
            background var(--hi-dur) var(--hi-ease),
            color var(--hi-dur) var(--hi-ease);
        }

        .hi-review-nav:hover {
          border-color: var(--hi-accent);
          background: var(--hi-accent);
          color: var(--hi-on-dark);
        }
      `}</style>
    </section>
  );
}
