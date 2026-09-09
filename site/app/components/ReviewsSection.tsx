"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Reveal from "./Reveal";
import type { Review } from "@/lib/db";

function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ color: "#B08A4A", letterSpacing: "0.15em", marginBottom: "1rem" }}>
      {"★".repeat(Math.round(rating))}
      <span style={{ color: "rgba(74,63,51,0.24)" }}>
        {"★".repeat(5 - Math.round(rating))}
      </span>
    </div>
  );
}

export default function ReviewsSection({ reviews, label }: { reviews: Review[]; label: string }) {
  const approved = [...reviews]
    .filter((r) => r.approved)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.order - b.order);

  const [index, setIndex] = useState(0);

  if (approved.length === 0) {
    return null;
  }

  const current = approved[index % approved.length];

  return (
    <section
      id="reviews"
      style={{
        padding: "clamp(5rem, 12vh, 9rem) 0",
        background: "#5A2630",
        color: "#F8F2E8",
      }}
    >
      <div className="hi-container" style={{ maxWidth: 780 }}>
        <Reveal>
          <p className="hi-label" style={{ color: "#C5A45E" }}>
            {label}
          </p>
        </Reveal>

        <div style={{ marginTop: "2.5rem", minHeight: 220 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <Stars rating={current.rating} />
              <p
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "clamp(1.3rem, 2.6vw, 1.8rem)",
                  fontWeight: 400,
                  lineHeight: 1.5,
                  marginBottom: "1.75rem",
                }}
              >
                &ldquo;{current.text}&rdquo;
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: current.photo
                      ? `center / cover no-repeat url(${current.photo})`
                      : "rgba(248,242,232,0.14)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontSize: "0.85rem",
                    letterSpacing: "0.04em",
                    color: "rgba(248,242,232,0.85)",
                  }}
                >
                  {current.name}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {approved.length > 1 && (
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "2.5rem" }}>
            {approved.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setIndex(i)}
                aria-label={`Show review ${i + 1}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  border: "none",
                  background:
                    i === index % approved.length
                      ? "#C5A45E"
                      : "rgba(248,242,232,0.28)",
                  transition: "background 0.3s ease",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
