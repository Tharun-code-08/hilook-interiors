import { ImageResponse } from "next/og";
import { getProjectBySlug } from "@/lib/repos/content";
import { getSettings } from "@/lib/repos/settings";

/**
 * Per-project Open Graph card.
 *
 * Generated rather than authored: there are as many cards as there are
 * projects, and the operator adds projects from the admin panel. Composed from
 * the project's own title and category so a shared link says what it is,
 * instead of falling back to the site-wide card for every project.
 *
 * Deliberately typographic — no project photograph. Fetching and decoding an
 * uploaded image inside the OG renderer is slow and fails silently when the
 * image is missing, which would leave a blank card rather than a plain one.
 */

export const alt = "Project — Hilook Interiors";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const [project, settings] = await Promise.all([getProjectBySlug(params.slug), getSettings()]);

  const title = project?.title ?? settings.siteName;
  const category = project?.category ?? "";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#26231F",
        padding: "72px 80px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 22,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#C5A45E",
            marginBottom: 8,
          }}
        >
          {category || "Project"}
        </div>
      </div>

      <div
        style={{
          fontSize: title.length > 34 ? 68 : 88,
          lineHeight: 1.05,
          color: "#F8F2E8",
          letterSpacing: -2,
          maxWidth: 1000,
          display: "flex",
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(248,242,232,0.22)",
          paddingTop: 28,
        }}
      >
        <div style={{ fontSize: 30, color: "#F8F2E8" }}>{settings.siteName}</div>
        <div style={{ fontSize: 22, letterSpacing: 4, color: "rgba(248,242,232,0.6)" }}>
          INTERIOR DESIGN
        </div>
      </div>
    </div>,
    size
  );
}
