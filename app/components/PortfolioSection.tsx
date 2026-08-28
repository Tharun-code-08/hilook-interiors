"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Reveal from "./Reveal";
import type { PortfolioProject } from "@/lib/db";

type Filter = "All" | "Residential" | "Commercial";

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 14,
    transform: "translateY(-50%)",
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "none",
    background: "rgba(20,16,12,0.55)",
    color: "#F8F2E8",
    fontSize: "1.4rem",
    lineHeight: 1,
    cursor: "pointer",
  };
}

export default function PortfolioSection({
  projects,
  label,
}: {
  projects: PortfolioProject[];
  label: string;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const [active, setActive] = useState<PortfolioProject | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  function openProject(project: PortfolioProject) {
    setActive(project);
    setActiveImage(0);
  }

  const sorted = [...projects].sort((a, b) => a.order - b.order);
  const visible =
    filter === "All" ? sorted : sorted.filter((p) => p.category === filter);

  return (
    <section
      id="portfolio"
      style={{
        padding: "clamp(5rem, 12vh, 9rem) 0",
        background: "#F4F1EA",
      }}
    >
      <div className="hi-container">
        <Reveal>
          <p className="hi-label">{label}</p>
        </Reveal>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            margin: "1.5rem 0 3rem",
            flexWrap: "wrap",
          }}
        >
          {(["All", "Residential", "Commercial"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? "#26231F" : "transparent",
                color: filter === f ? "#F8F2E8" : "#5E5951",
                border: "1px solid rgba(74,63,51,0.24)",
                padding: "0.55rem 1.4rem",
                fontFamily: "var(--font-inter)",
                fontSize: "0.7rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                transition: "all 0.3s ease",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p style={{ color: "#777168", fontFamily: "var(--font-inter)" }}>
            No projects in this category yet.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "1.75rem",
            }}
          >
            {visible.map((project, i) => (
              <Reveal key={project.id} index={i}>
                <button
                  onClick={() => openProject(project)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "4 / 5",
                      background: project.images[0]
                        ? `center / cover no-repeat url(${project.images[0]})`
                        : "linear-gradient(155deg, #173F35 0%, #26231F 100%)",
                      marginBottom: "1rem",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(to top, rgba(20,16,12,0.55), transparent 55%)",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 14,
                        left: 14,
                        fontFamily: "var(--font-inter)",
                        fontSize: "0.62rem",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "#F8F2E8",
                        background: "rgba(20,16,12,0.5)",
                        padding: "0.35rem 0.7rem",
                      }}
                    >
                      {project.category}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--font-playfair)",
                      fontSize: "1.2rem",
                      fontWeight: 400,
                      color: "#26231F",
                    }}
                  >
                    {project.title}
                  </h3>
                </button>
              </Reveal>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => setActive(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(18,14,10,0.92)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 880,
                width: "100%",
                maxHeight: "88vh",
                overflowY: "auto",
                background: "#F4F1EA",
              }}
            >
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    aspectRatio: "16 / 9",
                    background: active.images[activeImage]
                      ? `center / cover no-repeat url(${active.images[activeImage]})`
                      : "linear-gradient(155deg, #173F35 0%, #26231F 100%)",
                  }}
                />
                {active.images.length > 1 && (
                  <>
                    <button
                      aria-label="Previous image"
                      onClick={() =>
                        setActiveImage((i) => (i - 1 + active.images.length) % active.images.length)
                      }
                      style={arrowStyle("left")}
                    >
                      ‹
                    </button>
                    <button
                      aria-label="Next image"
                      onClick={() => setActiveImage((i) => (i + 1) % active.images.length)}
                      style={arrowStyle("right")}
                    >
                      ›
                    </button>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 12,
                        left: 0,
                        right: 0,
                        display: "flex",
                        justifyContent: "center",
                        gap: "0.4rem",
                      }}
                    >
                      {active.images.map((_, i) => (
                        <button
                          key={i}
                          aria-label={`Show image ${i + 1}`}
                          onClick={() => setActiveImage(i)}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            border: "none",
                            background: i === activeImage ? "#C5A45E" : "rgba(248,242,232,0.5)",
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div style={{ padding: "2rem clamp(1.5rem, 4vw, 3rem)" }}>
                <p className="hi-label">{active.category}</p>
                <h3
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                    fontWeight: 400,
                    margin: "0.8rem 0 1.2rem",
                    color: "#26231F",
                  }}
                >
                  {active.title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontWeight: 300,
                    lineHeight: 1.8,
                    color: "#5E5951",
                  }}
                >
                  {active.description}
                </p>
                <button
                  onClick={() => setActive(null)}
                  className="hi-cta-outline"
                  style={{ marginTop: "2rem" }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
