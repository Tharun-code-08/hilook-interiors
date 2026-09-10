"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Reveal from "./Reveal";
import CategoryFilter from "./CategoryFilter";
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

        <CategoryFilter
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          label="Filter projects by category"
        />

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
                    <span className="hi-project-media">
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
                    </span>
                    <h3 className="hi-project-title">{project.title}</h3>
                    <span className="hi-project-category">{project.category}</span>
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
