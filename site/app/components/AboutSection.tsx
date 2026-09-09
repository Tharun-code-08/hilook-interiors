import Reveal from "./Reveal";
import type { Settings } from "@/lib/db";

export default function AboutSection({ settings }: { settings: Settings }) {
  return (
    <section
      id="about"
      style={{
        padding: "clamp(5rem, 12vh, 9rem) 0",
        background: "#F4F1EA",
      }}
    >
      <div className="hi-container">
        <div
          className="hi-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "3rem",
            alignItems: "stretch",
          }}
        >
          <Reveal>
            <div
              style={{
                aspectRatio: "4 / 5",
                background: settings.aboutImage
                  ? `center / cover no-repeat url(${settings.aboutImage})`
                  : "linear-gradient(155deg, #173F35 0%, #26231F 100%)",
                width: "100%",
                minHeight: 320,
              }}
            />
          </Reveal>

          <Reveal index={1}>
            <div>
              <p className="hi-label" style={{ marginBottom: "1.25rem" }}>
                {settings.aboutLabel}
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontWeight: 400,
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  lineHeight: 1.2,
                  color: "#26231F",
                  marginBottom: "1.5rem",
                }}
              >
                {settings.aboutTitle}
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-inter)",
                  fontWeight: 300,
                  fontSize: "1.05rem",
                  lineHeight: 1.8,
                  color: "#5E5951",
                  marginBottom: "1.5rem",
                }}
              >
                {settings.aboutBody}
              </p>
              {settings.aboutCredentials && (
                <p
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontWeight: 400,
                    fontSize: "0.85rem",
                    letterSpacing: "0.02em",
                    color: "#777168",
                    borderTop: "1px solid rgba(74,63,51,0.16)",
                    paddingTop: "1.25rem",
                  }}
                >
                  {settings.aboutCredentials}
                </p>
              )}
            </div>
          </Reveal>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .hi-two-col {
            grid-template-columns: 1fr 1.1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
