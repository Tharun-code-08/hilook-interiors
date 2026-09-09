import type { MetadataRoute } from "next";
import { listProjects } from "@/lib/repos/content";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Generated from the datastore, so a project added in the admin panel appears
 * here without a code change — which is the point of having per-project routes
 * at all (finding H9).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await listProjects();
  const lastModified = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: absoluteUrl("/work"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...projects.map((project) => ({
      url: absoluteUrl(`/work/${project.slug}`),
      lastModified,
      changeFrequency: "yearly" as const,
      // Individual projects are the pages worth ranking, but the index and
      // home page are the entry points, hence just below them.
      priority: 0.8,
    })),
  ];
}
