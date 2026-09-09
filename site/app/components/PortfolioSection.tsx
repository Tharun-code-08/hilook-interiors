"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Reveal from "./Reveal";
import type { PortfolioProject } from "@/lib/types";

type Filter = "All" | "Residential" | "Commercial";

const FILTERS: Filter[] = ["All", "Residential", "Commercial"];

/**
 * The portfolio grid on the home page.
 *
 * Cards used to be buttons that opened a modal. That made every project
 * unaddressable — nothing to link to, nothing to share, nothing for a crawler
 * to follow (finding H9). They are now real anchors to /work/<slug>, where the
 * full gallery and the project's own metadata live.
 *
 * The filter stays client-side: it narrows a list already on the page, and
 * every card underneath is a crawlable link regardless of the current filter.
 */
export default function PortfolioSection({
  projects,
  label,
}: {
  projects: PortfolioProject[];
  label: string;
}) {
  const [filter, setFilter] = useState<Filter>("All");

  const sorted = [...projects].sort((a, b) => a.order - b.order);
  const visible = filter === "All" ? sorted : sorted.filter((p) => p.category === filter);

  return (
    <section
      id="portfolio"
      aria-labelledby="portfolio-heading"
      style={{ padding: "clamp(5rem, 12vh, 9rem) 0", background: "var(--hi-surface)" }}
    >
      <div className="hi-container">
        <Reveal>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <h2 id="portfolio-heading" className="hi-label">
              {label}
            </h2>
            <Link
              href="/work"
              className="hi-focusable"
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "0.72rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--hi-accent-text)",
              }}
            >
              View all projects →
            </Link>
          </div>
        </Reveal>

        <div
          role="group"
          aria-label="Filter projects by category"
          style={{ display: "flex", gap: "0.75rem", margin: "1.5rem 0 3rem", flexWrap: "wrap" }}
        >
          {FILTERS.map((f) => {
            const selected = filter === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(f)}
                className="hi-focusable"
                style={{
                  background: selected ? "var(--hi-ink)" : "transparent",
                  color: selected ? "var(--hi-on-dark)" : "var(--hi-ink-muted)",
                  border: "1px solid var(--hi-rule-strong)",
                  padding: "0.6rem 1.4rem",
                  minHeight: 44,
                  fontFamily: "var(--font-inter)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  transition: "background 0.3s ease, color 0.3s ease, border-color 0.3s ease",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <p style={{ color: "var(--hi-ink-soft)", fontFamily: "var(--font-inter)" }}>
            No projects in this category yet.
          </p>
        ) : (
          <ul className="hi-project-grid">
            {visible.map((project, i) => (
              <li key={project.id}>
                <Reveal index={i}>
                  <Link
                    href={`/work/${project.slug}`}
                    className="hi-project-card hi-focusable"
                    aria-label={`${project.title} — ${project.category}`}
                  >
                    <span
                      style={{
                        position: "relative",
                        display: "block",
                        aspectRatio: "4 / 5",
                        marginBottom: "1rem",
                        overflow: "hidden",
                        background: "linear-gradient(155deg, #173F35 0%, #26231F 100%)",
                      }}
                    >
                      {project.images[0] && (
                        <Image
                          src={project.images[0]}
                          alt=""
                          aria-hidden="true"
                          fill
                          sizes="(min-width: 1240px) 380px, (min-width: 700px) 45vw, 100vw"
                          loading={i < 2 ? "eager" : "lazy"}
                          className="hi-project-image"
                          style={{ objectFit: "cover" }}
                        />
                      )}
                      <span
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
                          color: "var(--hi-on-dark)",
                          background: "rgba(20,16,12,0.5)",
                          padding: "0.35rem 0.7rem",
                        }}
                      >
                        {project.category}
                      </span>
                    </span>
                    <h3
                      style={{
                        fontFamily: "var(--font-playfair)",
                        fontSize: "1.2rem",
                        fontWeight: 400,
                        color: "var(--hi-ink)",
                      }}
                    >
                      {project.title}
                    </h3>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
