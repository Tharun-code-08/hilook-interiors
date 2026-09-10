import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { getProjectBySlug, listProjects } from "@/lib/repos/content";
import { getSettings } from "@/lib/repos/settings";
import { recordPageview } from "@/lib/repos/analytics";
import { clientIp } from "@/lib/request";
import { absoluteUrl, siteUrl } from "@/lib/site-url";

import SiteHeader from "@/app/components/SiteHeader";
import Footer from "@/app/components/Footer";
import FloatingContactButton from "@/app/components/FloatingContactButton";
import ProjectGallery from "@/app/components/ProjectGallery";

/**
 * A project's own page.
 *
 * This is the fix for finding H9: the whole public site was one URL, so
 * individual projects — the highest-value, most-searched content an interiors
 * studio owns — could not be linked, shared, or indexed. Each project now has
 * an address, its own metadata, its own Open Graph card, and BreadcrumbList
 * structured data.
 */

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [project, settings] = await Promise.all([getProjectBySlug(slug), getSettings()]);

  // generateMetadata runs before the component, so it has to handle a missing
  // project on its own — the notFound() below has not been reached yet.
  //
  // This used to return 200 alongside the 404 page. The cause was app/loading.tsx
  // sitting at the app root: it wrapped every segment in a Suspense boundary, so
  // the shell and its 200 status were flushed before the page body ran, and
  // notFound() could no longer change the status. It now lives in app/(home)/,
  // scoped to the one route that wants it. The noindex stays as belt and braces —
  // it costs nothing and a soft 404 is only harmful because crawlers index it.
  if (!project) {
    return {
      title: "Project not found",
      robots: { index: false, follow: false },
    };
  }

  // Placeholder copy shouldn't become a search-result snippet.
  const isPlaceholder = project.description.includes("Editable placeholder");
  const description = isPlaceholder
    ? `${project.title} — a ${project.category.toLowerCase()} project by ${settings.siteName}.`
    : project.description.slice(0, 200);

  return {
    title: project.title,
    description,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      type: "article",
      title: project.title,
      description,
      url: absoluteUrl(`/work/${project.slug}`),
      siteName: settings.siteName,
    },
    twitter: { card: "summary_large_image", title: project.title, description },
  };
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const h = await headers();

  const [project, settings, allProjects] = await Promise.all([
    getProjectBySlug(slug),
    getSettings(),
    listProjects(),
  ]);

  if (!project) notFound();

  await recordPageview({
    path: `/work/${slug}`,
    referrer: h.get("referer"),
    ip: clientIp(h),
    userAgent: h.get("user-agent") ?? "",
  });

  const [hero, ...rest] = project.images;
  const others = allProjects.filter((p) => p.id !== project.id).slice(0, 3);
  const base = siteUrl();

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Work", item: absoluteUrl("/work") },
      {
        "@type": "ListItem",
        position: 3,
        name: project.title,
        item: absoluteUrl(`/work/${project.slug}`),
      },
    ],
  };

  return (
    <>
      <a href="#main-content" className="hi-skip-link">
        Skip to content
      </a>
      <SiteHeader siteName={settings.siteName} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c"),
        }}
      />

      <main id="main-content" style={{ background: "var(--hi-surface)" }}>
        {/* Offsets the fixed header, which has no hero to sit over here. */}
        <div style={{ height: 68 }} />

        <article>
          <div className="hi-container" style={{ paddingTop: "clamp(2rem, 6vh, 4rem)" }}>
            <nav aria-label="Breadcrumb" style={{ marginBottom: "1.75rem" }}>
              <ol
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  listStyle: "none",
                  flexWrap: "wrap",
                  fontFamily: "var(--font-inter)",
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--hi-ink-soft)",
                }}
              >
                <li>
                  <Link href="/" className="hi-crumb-link">
                    Home
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <Link href="/work" className="hi-crumb-link">
                    Work
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page" style={{ color: "var(--hi-accent-text)" }}>
                  {project.title}
                </li>
              </ol>
            </nav>

            <p className="hi-label" style={{ marginBottom: "1rem" }}>
              {project.category}
            </p>
            <h1
              style={{
                fontFamily: "var(--font-playfair)",
                fontWeight: 400,
                fontSize: "clamp(2.2rem, 5vw, 4rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "var(--hi-ink)",
                textWrap: "balance",
                maxWidth: "18ch",
                marginBottom: "1.75rem",
              }}
            >
              {project.title}
            </h1>
          </div>

          {hero && (
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                background: "linear-gradient(155deg, #173F35 0%, #26231F 100%)",
                marginBottom: "clamp(2.5rem, 6vh, 4rem)",
              }}
            >
              <Image
                src={hero}
                alt={`${project.title} — principal view`}
                fill
                sizes="100vw"
                priority
                style={{ objectFit: "cover" }}
              />
            </div>
          )}

          <div className="hi-container">
            <div className="hi-project-body">
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontWeight: 300,
                    fontSize: "1.06rem",
                    lineHeight: 1.85,
                    color: "var(--hi-ink-muted)",
                    maxWidth: "62ch",
                  }}
                >
                  {project.description || "Project details coming soon."}
                </p>
              </div>

              <dl className="hi-project-meta">
                <div>
                  <dt className="hi-label">Category</dt>
                  <dd style={{ color: "var(--hi-ink)", marginTop: "0.35rem" }}>
                    {project.category}
                  </dd>
                </div>
                <div>
                  <dt className="hi-label">Images</dt>
                  <dd
                    style={{
                      color: "var(--hi-ink)",
                      marginTop: "0.35rem",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {project.images.length}
                  </dd>
                </div>
              </dl>
            </div>

            {rest.length > 0 && (
              <section
                aria-labelledby="gallery-heading"
                style={{ marginTop: "clamp(3rem, 8vh, 5rem)" }}
              >
                <h2 id="gallery-heading" className="hi-label" style={{ marginBottom: "1.5rem" }}>
                  Gallery
                </h2>
                <ProjectGallery images={rest} title={project.title} />
              </section>
            )}
          </div>
        </article>

        {others.length > 0 && (
          <section
            aria-labelledby="more-heading"
            style={{
              marginTop: "clamp(4rem, 10vh, 7rem)",
              padding: "clamp(3rem, 8vh, 5rem) 0",
              background: "var(--hi-surface-alt)",
              borderTop: "1px solid var(--hi-rule)",
            }}
          >
            <div className="hi-container">
              <h2 id="more-heading" className="hi-label" style={{ marginBottom: "1.75rem" }}>
                More projects
              </h2>
              <ul className="hi-project-grid">
                {others.map((other) => (
                  <li key={other.id}>
                    <ProjectCard project={other} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section style={{ padding: "clamp(3rem, 8vh, 5rem) 0", textAlign: "center" }}>
          <div className="hi-container">
            <p
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "clamp(1.4rem, 3vw, 2.2rem)",
                color: "var(--hi-ink)",
                marginBottom: "1.75rem",
                textWrap: "balance",
              }}
            >
              Considering a project of your own?
            </p>
            <Link href="/#contact" className="hi-cta">
              {settings.heroClosingCta}
            </Link>
          </div>
        </section>
      </main>

      <Footer settings={settings} />
      <FloatingContactButton settings={settings} />
    </>
  );
}

function ProjectCard({
  project,
}: {
  project: { slug: string; title: string; category: string; images: string[] };
}) {
  return (
    <Link href={`/work/${project.slug}`} className="hi-project-card hi-focusable">
      <span className="hi-project-media">
        {project.images[0] && (
          <Image
            src={project.images[0]}
            alt=""
            aria-hidden="true"
            fill
            sizes="(min-width: 1000px) 30vw, 100vw"
            className="hi-project-image"
            style={{ objectFit: "cover" }}
          />
        )}
      </span>
      <span className="hi-project-title">{project.title}</span>
      <span className="hi-project-category">{project.category}</span>
    </Link>
  );
}
