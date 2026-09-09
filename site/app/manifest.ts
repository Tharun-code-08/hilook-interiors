import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/repos/settings";

/**
 * Web app manifest. Named from settings so a rebrand in the admin panel
 * carries through to the install prompt without a code change.
 *
 * Same trap as the sitemap: metadata routes are prerendered by default, so
 * this was frozen with whatever the site was called at build time. Renaming
 * the studio in the panel changed the site and not the install prompt.
 */
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings();

  return {
    name: settings.siteName,
    short_name: settings.siteName.split(" ")[0],
    description: settings.metaDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#F4F1EA",
    theme_color: "#26231F",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
