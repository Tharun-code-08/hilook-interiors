import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";

import { listProjects } from "@/lib/repos/content";
import { getSettings } from "@/lib/repos/settings";
import { recordPageview } from "@/lib/repos/analytics";
import { clientIp } from "@/lib/request";
import { absoluteUrl, siteUrl } from "@/lib/site-url";

import SiteHeader from "@/app/components/SiteHeader";
import Footer from "@/app/components/Footer";
import FloatingContactButton from "@/app/components/FloatingContactButton";

/**
 * The project index.
 *
 * A crawlable list of every project, which is what gives the per-project pages
 * a path in from the site's own structure rather than only from the sitemap.
 */

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = `Selected residential and commercial interior design projects by ${settings.siteName}.`;

  return {
    title: "Work",
    description,
    alternates: { canonical: "/work" },
    openGraph: {
      type: "website",
      title: `Work · ${settings.siteName}`,
      description,
      url: absoluteUrl("/work"),
    },
  };
}

export default async function WorkIndexPage() {
  const h = await headers();
  const [projects, settings] = await Promise.all([listProjects(), getSettings()]);

  await recordPageview({
    path: "/work",
    referrer: h.get("referer"),
    ip: clientIp(h),
    userAgent: h.get("user-agent") ?? "",
  });

  const base = siteUrl();

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Work", item: absoluteUrl("/work") },
    ],
  };

  // An ItemList makes the collection itself legible to a crawler, rather than
  // relying on it to infer one from the markup.
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: projects.map((project, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/work/${project.slug}`),
      name: project.title,
    })),
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
          __html: JSON.stringify([breadcrumbs, itemList]).replace(/</g, "\\u003c"),
        }}
      />

      <main id="main-content" style={{ background: "var(--hi-surface)", minHeight: "100vh" }}>
        <div style={{ height: 68 }} />

        <div className="hi-container" style={{ padding: "clamp(2rem, 6vh, 4rem) 0" }}>
          <nav aria-label="Breadcrumb" style={{ marginBottom: "1.5rem" }}>
            <ol
              style={{
                display: "flex",
                gap: "0.5rem",
                listStyle: "none",
                fontFamily: "var(--font-inter)",
                fontSize: "0.72rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--hi-ink-soft)",
              }}
            >
              <li>
                <Link href="/" style={{ textDecoration: "none" }}>
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" style={{ color: "var(--hi-accent-text)" }}>
                Work
              </li>
            </ol>
          </nav>

          <h1
            style={{
              fontFamily: "var(--font-playfair)",
              fontWeight: 400,
              fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              color: "var(--hi-ink)",
              marginBottom: "1rem",
              textWrap: "balance",
            }}
          >
            {settings.portfolioLabel}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-inter)",
              fontWeight: 300,
              fontSize: "1.02rem",
              lineHeight: 1.8,
              color: "var(--hi-ink-muted)",
              maxWidth: "56ch",
              marginBottom: "clamp(2.5rem, 6vh, 4rem)",
            }}
          >
            Residential and commercial interiors, each resolved from the architecture out.
          </p>

          {projects.length === 0 ? (
            <p style={{ color: "var(--hi-ink-soft)" }}>
              No projects published yet — add them from the admin panel.
            </p>
          ) : (
            <ul className="hi-project-grid">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link href={`/work/${project.slug}`} className="hi-project-card hi-focusable">
                    <span
                      style={{
                        position: "relative",
                        display: "block",
                        aspectRatio: "4 / 5",
                        overflow: "hidden",
                        marginBottom: "1rem",
                        background: "linear-gradient(155deg, #173F35 0%, #26231F 100%)",
                      }}
                    >
                      {project.images[0] && (
                        <Image
                          src={project.images[0]}
                          alt=""
                          aria-hidden="true"
                          fill
                          sizes="(min-width: 1000px) 30vw, (min-width: 700px) 45vw, 100vw"
                          className="hi-project-image"
                          style={{ objectFit: "cover" }}
                        />
                      )}
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
                          background: "rgba(20,16,12,0.55)",
                          padding: "0.35rem 0.7rem",
                        }}
                      >
                        {project.category}
                      </span>
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-playfair)",
                        fontSize: "1.2rem",
                        color: "var(--hi-ink)",
                      }}
                    >
                      {project.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <Footer settings={settings} />
      <FloatingContactButton settings={settings} />
    </>
  );
}
