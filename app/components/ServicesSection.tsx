import Reveal from "./Reveal";
import type { Service } from "@/lib/db";

export default function ServicesSection({
  services,
  intro,
  label,
}: {
  services: Service[];
  intro: string;
  label: string;
}) {
  const sorted = [...services].sort((a, b) => a.order - b.order);

  return (
    <section
      id="services"
      style={{
        padding: "clamp(5rem, 12vh, 9rem) 0",
        background: "#EFEAE0",
      }}
    >
      <div className="hi-container">
        <Reveal>
          <p className="hi-label">{label}</p>
        </Reveal>
        <Reveal index={1}>
          <p
            style={{
              fontFamily: "var(--font-inter)",
              fontWeight: 300,
              fontSize: "1rem",
              color: "#5E5951",
              maxWidth: "48ch",
              margin: "1.25rem 0 3.5rem",
            }}
          >
            {intro}
          </p>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "2.5rem",
          }}
        >
          {sorted.map((svc, i) => (
            <Reveal key={svc.id} index={i + 2}>
              <div
                style={{
                  border: "1px solid rgba(74,63,51,0.16)",
                  background: "#F4F1EA",
                  height: "100%",
                  overflow: "hidden",
                }}
              >
                {svc.image && (
                  <div
                    aria-hidden
                    style={{
                      aspectRatio: "16 / 10",
                      background: `center / cover no-repeat url(${svc.image})`,
                    }}
                  />
                )}
                <div style={{ padding: "2.2rem 1.8rem" }}>
                <div
                  aria-hidden
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: "1px solid #B08A4A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.5rem",
                    color: "#B08A4A",
                    fontFamily: "var(--font-playfair)",
                    fontSize: "1.1rem",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontWeight: 400,
                    fontSize: "1.4rem",
                    color: "#26231F",
                    marginBottom: "0.8rem",
                  }}
                >
                  {svc.name}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontWeight: 300,
                    fontSize: "0.95rem",
                    lineHeight: 1.7,
                    color: "#5E5951",
                  }}
                >
                  {svc.description}
                </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
