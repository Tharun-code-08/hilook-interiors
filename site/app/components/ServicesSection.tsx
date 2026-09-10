import Image from "next/image";
import Reveal from "./Reveal";
import type { Service } from "@/lib/types";

/**
 * Services.
 *
 * Was a grid of bordered cards, each opening with a number in a circled
 * outline — a pattern that reads as a generic template rather than a design
 * studio, and one that fought the editorial typography everywhere else on the
 * page. It also had no hover state, because inline styles can't express one.
 *
 * Now: a rule-separated list. The index sits in the margin as a quiet ordinal
 * rather than a decorated badge, the service name carries the display face at
 * a size that can hold the column.
 * Where a service has an image it becomes a third column; where it doesn't,
 * the row simply doesn't reserve dead space for one.
 */
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
      aria-labelledby="services-heading"
      style={{
        padding: "clamp(5rem, 12vh, 9rem) 0",
        background: "var(--hi-surface-alt)",
      }}
    >
      <div className="hi-container">
        <div className="hi-services-head">
          <Reveal>
            <p className="hi-label" id="services-heading">
              {label}
            </p>
          </Reveal>
          <Reveal index={1}>
            <p
              style={{
                fontFamily: "var(--font-playfair)",
                fontWeight: 400,
                fontSize: "clamp(1.35rem, 2.4vw, 1.9rem)",
                lineHeight: 1.45,
                color: "var(--hi-ink)",
                maxWidth: "34ch",
                textWrap: "balance",
              }}
            >
              {intro}
            </p>
          </Reveal>
        </div>

        <ul
          style={{
            listStyle: "none",
            margin: "clamp(2.5rem, 6vh, 4rem) 0 0",
            borderTop: "1px solid var(--hi-rule)",
          }}
        >
          {sorted.map((svc, i) => (
            <li key={svc.id}>
              <Reveal index={i}>
                <article className="hi-service-row" data-has-image={svc.image ? "true" : "false"}>
                  <span aria-hidden className="hi-service-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="hi-service-body">
                    <h3
                      style={{
                        fontFamily: "var(--font-playfair)",
                        fontWeight: 400,
                        fontSize: "clamp(1.35rem, 2.2vw, 1.75rem)",
                        lineHeight: 1.25,
                        color: "var(--hi-ink)",
                        marginBottom: "0.65rem",
                        textWrap: "balance",
                      }}
                    >
                      {svc.name}
                    </h3>
                    <p
                      style={{
                        fontFamily: "var(--font-inter)",
                        fontWeight: 300,
                        fontSize: "0.97rem",
                        lineHeight: 1.75,
                        color: "var(--hi-ink-muted)",
                        maxWidth: "56ch",
                      }}
                    >
                      {svc.description}
                    </p>
                  </div>

                  {svc.image && (
                    <div className="hi-service-media">
                      <Image
                        src={svc.image}
                        alt={svc.name}
                        fill
                        sizes="(min-width: 1000px) 260px, (min-width: 700px) 30vw, 100vw"
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                  )}
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>

      <style>{`
        .hi-services-head {
          display: grid;
          gap: 1.25rem;
        }

        @media (min-width: 860px) {
          .hi-services-head {
            grid-template-columns: 1fr 1.6fr;
            align-items: start;
            gap: clamp(2rem, 5vw, 4rem);
          }
        }

        .hi-service-row {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 1rem 1.5rem;
          align-items: start;
          padding: clamp(1.75rem, 4vh, 2.75rem) 0;
          border-bottom: 1px solid var(--hi-rule);
        }

        /* Deliberately no hover. This row used to wash lighter under the
           pointer, which is how a list says "click me" — and a service row
           has nowhere to go, so it invited a click that did nothing. */

        .hi-service-index {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.18em;
          color: var(--hi-accent-text);
          font-variant-numeric: tabular-nums;
          padding-top: 0.55rem;
          min-width: 2.5rem;
        }

        .hi-service-media {
          position: relative;
          grid-column: 1 / -1;
          aspect-ratio: 16 / 10;
          overflow: hidden;
          order: 3;
        }

        @media (min-width: 860px) {
          .hi-service-row[data-has-image="true"] {
            grid-template-columns: auto 1fr 260px;
          }

          .hi-service-media {
            grid-column: auto;
            aspect-ratio: 4 / 3;
            order: 0;
            align-self: stretch;
            min-height: 100%;
          }
        }
      `}</style>
    </section>
  );
}
