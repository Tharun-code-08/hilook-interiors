import Image from "next/image";
import Reveal from "./Reveal";
import type { Settings } from "@/lib/types";

/**
 * The first thing after the hero, so it carries the whole burden of the
 * transition out of the cinematic sequence.
 *
 * The previous version was a plain two-column grid — image left, text right,
 * equal weight, centred in the container — which read as a generic template
 * immediately after a genuinely cinematic opener. That drop is what made the
 * page feel like it fell off a cliff below the fold.
 *
 * What carries it now: an asymmetric split with the image bleeding to the
 * page edge, a pull-quote scale on the heading, and the credentials set as a
 * rule-separated footnote rather than another paragraph.
 */
export default function AboutSection({ settings }: { settings: Settings }) {
  const isPlaceholder = settings.aboutBody.includes("Editable placeholder");

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      style={{
        padding: "clamp(6rem, 16vh, 11rem) 0 clamp(5rem, 12vh, 9rem)",
        background: "var(--hi-surface)",
        overflow: "hidden",
      }}
    >
      <div className="hi-about-grid">
        {/* Image bleeds off the left edge on wide screens — the container's
            symmetric gutter is exactly what made this read as a template. */}
        <Reveal className="hi-about-media">
          <div
            style={{
              position: "relative",
              aspectRatio: "4 / 5",
              width: "100%",
              minHeight: 340,
              overflow: "hidden",
              background: "linear-gradient(155deg, #173F35 0%, #26231F 100%)",
            }}
          >
            {settings.aboutImage && (
              <Image
                src={settings.aboutImage}
                alt={`Interior designed by ${settings.siteName}`}
                fill
                sizes="(min-width: 1000px) 46vw, 100vw"
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
        </Reveal>

        <div className="hi-about-copy">
          <Reveal index={1}>
            <p className="hi-label" style={{ marginBottom: "1.5rem" }}>
              {settings.aboutLabel}
            </p>

            <h2
              id="about-heading"
              style={{
                fontFamily: "var(--font-playfair)",
                fontWeight: 400,
                fontSize: "clamp(2.1rem, 3.6vw, 3.4rem)",
                lineHeight: 1.14,
                letterSpacing: "-0.015em",
                color: "var(--hi-ink)",
                textWrap: "balance",
                marginBottom: "1.75rem",
              }}
            >
              {settings.aboutTitle}
            </h2>

            {/* A hairline rule instead of a gap: it gives the column a spine
                and ties the heading to the body without adding another box. */}
            <div
              aria-hidden
              style={{
                width: 56,
                height: 1,
                background: "var(--hi-accent)",
                marginBottom: "1.75rem",
              }}
            />

            <p
              style={{
                fontFamily: "var(--font-inter)",
                fontWeight: 300,
                fontSize: "1.06rem",
                lineHeight: 1.85,
                color: "var(--hi-ink-muted)",
                maxWidth: "58ch",
                marginBottom: settings.aboutCredentials ? "2.5rem" : 0,
              }}
            >
              {settings.aboutBody}
            </p>

            {settings.aboutCredentials && (
              <p
                style={{
                  fontFamily: "var(--font-inter)",
                  fontWeight: 400,
                  fontSize: "0.84rem",
                  lineHeight: 1.7,
                  letterSpacing: "0.01em",
                  color: "var(--hi-ink-soft)",
                  borderTop: "1px solid var(--hi-rule)",
                  paddingTop: "1.35rem",
                  maxWidth: "52ch",
                }}
              >
                {settings.aboutCredentials}
              </p>
            )}

            {isPlaceholder && (
              <p
                style={{
                  marginTop: "1.5rem",
                  fontSize: "0.76rem",
                  color: "var(--hi-ink-faint)",
                  fontStyle: "italic",
                }}
              >
                Placeholder copy — replace from Admin → Content.
              </p>
            )}
          </Reveal>
        </div>
      </div>

      <style>{`
        .hi-about-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: clamp(2.5rem, 6vw, 4.5rem);
          align-items: center;
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 clamp(1.25rem, 5vw, 4rem);
        }

        @media (min-width: 1000px) {
          .hi-about-grid {
            /* Asymmetric: the image gets the larger share and starts at the
               page edge, so the copy column reads as the deliberate inset. */
            grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
            max-width: 1560px;
            padding-left: 0;
            padding-right: clamp(2rem, 7vw, 7rem);
          }

          .hi-about-copy {
            padding-left: clamp(1rem, 2vw, 2.5rem);
          }
        }
      `}</style>
    </section>
  );
}
