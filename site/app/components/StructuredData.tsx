import type { PortfolioProject, Review, Settings } from "@/lib/types";
import { absoluteUrl, siteUrl } from "@/lib/site-url";
import { POSTER_FRAME_SRC } from "@/lib/hero-frames";

/**
 * JSON-LD for the home page.
 *
 * An interior design studio is a LocalBusiness with a service area — that is
 * the schema type that produces a knowledge panel and rich results for
 * "interior designer near me" style queries, which is most of the intent a
 * studio like this wants to capture.
 *
 * Everything here is derived from real settings and real content. Fields the
 * operator hasn't filled in are omitted rather than guessed: an incomplete
 * entity is fine, a fabricated address or rating is not — and inventing
 * aggregate ratings is specifically against Google's structured data policy.
 */
/**
 * The seeded placeholder is "+91 00000 00000" — a real country code followed
 * by an all-zero subscriber number, so checking the whole string for zeros
 * isn't enough. No genuine number ends in eight zeros, so that's the test.
 */
function isRealPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return false;
  return !/0{8,}$/.test(digits);
}

export default function StructuredData({
  settings,
  projects,
  reviews,
}: {
  settings: Settings;
  projects: PortfolioProject[];
  reviews: Review[];
}) {
  const base = siteUrl();

  const sameAs = [settings.instagramUrl, settings.pinterestUrl, settings.facebookUrl].filter(
    (url): url is string => Boolean(url && url.trim())
  );

  // "Editable placeholder" is the seed marker; treat those as absent.
  const hasRealAddress =
    Boolean(settings.contactAddress?.trim()) &&
    !settings.contactAddress.includes("Editable placeholder");

  const approvedReviews = reviews.filter((r) => r.approved && r.name !== "Sample Client");

  const organization: Record<string, unknown> = {
    "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
    "@id": `${base}/#organization`,
    name: settings.siteName,
    description: settings.metaDescription,
    url: base,
    image: absoluteUrl(POSTER_FRAME_SRC),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(settings.contactEmail && !settings.contactEmail.includes("example")
      ? { email: settings.contactEmail }
      : {}),
    ...(isRealPhone(settings.contactPhone) ? { telephone: settings.contactPhone } : {}),
    ...(hasRealAddress
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: settings.contactAddress,
          },
        }
      : {}),
  };

  // Only claim an aggregate rating when there are genuine approved reviews
  // behind it.
  if (approvedReviews.length > 0) {
    const average = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;
    organization.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(average.toFixed(1)),
      reviewCount: approvedReviews.length,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const graph: Record<string, unknown>[] = [
    organization,
    {
      "@type": "WebSite",
      "@id": `${base}/#website`,
      url: base,
      name: settings.siteName,
      publisher: { "@id": `${base}/#organization` },
      inLanguage: "en",
    },
  ];

  // Each project as a CreativeWork with its images, so the portfolio is
  // machine-readable and eligible for image rich results.
  for (const project of projects) {
    graph.push({
      "@type": "CreativeWork",
      "@id": `${base}/#project-${project.id}`,
      name: project.title,
      ...(project.description && !project.description.includes("Editable placeholder")
        ? { description: project.description }
        : {}),
      genre: project.category,
      creator: { "@id": `${base}/#organization` },
      ...(project.images.length > 0
        ? { image: project.images.map((src) => absoluteUrl(src)) }
        : {}),
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is data, not markup. The "<" escape prevents a
      // string containing "</script>" from breaking out of the element.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
