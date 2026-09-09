import Reveal from "./Reveal";
import type { AwardItem } from "@/lib/db";

const LABELS: Record<AwardItem["kind"], string> = {
  award: "Awards",
  press: "Press",
  certification: "Certifications",
};

export default function AwardsSection({ items, label }: { items: AwardItem[]; label: string }) {
  if (items.length === 0) return null;

  const groups = (["award", "press", "certification"] as const)
    .map((kind) => ({ kind, items: items.filter((i) => i.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <section
      id="recognition"
      style={{
        padding: "clamp(4rem, 10vh, 7rem) 0",
        background: "#EFEAE0",
        borderTop: "1px solid rgba(74,63,51,0.16)",
        borderBottom: "1px solid rgba(74,63,51,0.16)",
      }}
    >
      <div className="hi-container">
        <Reveal>
          <p className="hi-label">{label}</p>
        </Reveal>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "2.5rem",
            marginTop: "2rem",
          }}
        >
          {groups.map((group, gi) => (
            <Reveal key={group.kind} index={gi + 1}>
              <h3
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "1.15rem",
                  fontWeight: 400,
                  marginBottom: "1rem",
                  color: "#26231F",
                }}
              >
                {LABELS[group.kind]}
              </h3>
              <ul style={{ listStyle: "none" }}>
                {group.items.map((item) => (
                  <li key={item.id} style={{ marginBottom: "0.9rem" }}>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontFamily: "var(--font-inter)",
                          fontSize: "0.9rem",
                          color: "#5E5951",
                          textDecoration: "underline",
                          textDecorationColor: "rgba(176,138,74,0.5)",
                        }}
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span
                        style={{
                          fontFamily: "var(--font-inter)",
                          fontSize: "0.9rem",
                          color: "#5E5951",
                        }}
                      >
                        {item.title}
                      </span>
                    )}
                    {item.detail && (
                      <span style={{ display: "block", fontSize: "0.8rem", color: "#777168" }}>
                        {item.detail}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
