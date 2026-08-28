import Reveal from "./Reveal";
import type { ProcessStep } from "@/lib/db";

export default function ProcessSection({
  steps,
  label,
}: {
  steps: ProcessStep[];
  label: string;
}) {
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  return (
    <section
      id="process"
      style={{
        padding: "clamp(5rem, 12vh, 9rem) 0",
        background: "#173F35",
        color: "#F4F1EA",
      }}
    >
      <div className="hi-container">
        <Reveal>
          <p className="hi-label" style={{ color: "#C5A45E" }}>
            {label}
          </p>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "3rem",
            marginTop: "3rem",
          }}
        >
          {sorted.map((step, i) => (
            <Reveal key={step.id} index={i + 1}>
              <div
                style={{
                  borderTop: "1px solid rgba(244,241,234,0.24)",
                  paddingTop: "1.75rem",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontSize: "2.2rem",
                    color: "#B08A4A",
                    display: "block",
                    marginBottom: "1rem",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontWeight: 400,
                    fontSize: "1.5rem",
                    marginBottom: "0.9rem",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontWeight: 300,
                    fontSize: "0.95rem",
                    lineHeight: 1.75,
                    color: "rgba(244,241,234,0.78)",
                  }}
                >
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
