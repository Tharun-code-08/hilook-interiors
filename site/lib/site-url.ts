/**
 * The site's canonical absolute origin.
 *
 * Needed by metadataBase, canonical URLs, sitemap entries, JSON-LD, and Open
 * Graph image URLs — all of which must be absolute. Falls back to the Vercel
 * deployment URL, then localhost, so previews produce correct (if temporary)
 * absolute links rather than broken relative ones.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
