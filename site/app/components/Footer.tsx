"use client";

import { useState } from "react";
import type { Settings } from "@/lib/types";

const NAV = [
  { href: "#about", label: "About" },
  { href: "#services", label: "Services" },
  { href: "#portfolio", label: "Projects" },
  { href: "#process", label: "Process" },
  { href: "#reviews", label: "Reviews" },
  { href: "#contact", label: "Contact" },
];

export default function Footer({ settings }: { settings: Settings }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Honeypot — see ContactSection for the reasoning.
  const [website, setWebsite] = useState("");

  async function onSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });

      if (!res.ok) {
        // A silently-swallowed failure here means the visitor believes they
        // subscribed and never hears from the studio again.
        let message = "Couldn't sign you up just now.";
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          /* keep the fallback */
        }
        setError(message);
        return;
      }

      setSent(true);
      setEmail("");
    } catch {
      setError("Couldn't reach the server. Please try again.");
    }
  }

  return (
    <footer style={{ background: "#26231F", color: "#F4F1EA", padding: "4rem 0 2rem" }}>
      <div className="hi-container">
        <div
          className="hi-footer-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "2.5rem",
            paddingBottom: "2.5rem",
            borderBottom: "1px solid rgba(244,241,234,0.14)",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "1.4rem",
                marginBottom: "0.75rem",
              }}
            >
              {settings.siteName}
            </p>
            <p
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "0.85rem",
                color: "rgba(244,241,234,0.6)",
                maxWidth: "36ch",
              }}
            >
              {settings.footerTagline}
            </p>
          </div>

          <nav>
            <p className="hi-label" style={{ marginBottom: "1rem", color: "#C5A45E" }}>
              Navigate
            </p>
            <ul style={{ listStyle: "none", display: "grid", gap: "0.6rem" }}>
              {NAV.map((n) => (
                <li key={n.href}>
                  <a
                    href={n.href}
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: "0.85rem",
                      color: "rgba(244,241,234,0.75)",
                    }}
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="hi-label" style={{ marginBottom: "1rem", color: "#C5A45E" }}>
              Follow
            </p>
            <ul style={{ listStyle: "none", display: "grid", gap: "0.6rem" }}>
              {settings.instagramUrl && (
                <li>
                  <a
                    href={settings.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.85rem", color: "rgba(244,241,234,0.75)" }}
                  >
                    Instagram
                  </a>
                </li>
              )}
              {settings.pinterestUrl && (
                <li>
                  <a
                    href={settings.pinterestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.85rem", color: "rgba(244,241,234,0.75)" }}
                  >
                    Pinterest
                  </a>
                </li>
              )}
              {settings.facebookUrl && (
                <li>
                  <a
                    href={settings.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.85rem", color: "rgba(244,241,234,0.75)" }}
                  >
                    Facebook
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="hi-label" style={{ marginBottom: "1rem", color: "#C5A45E" }}>
              Newsletter
            </p>
            {sent ? (
              <p style={{ fontSize: "0.85rem", color: "rgba(244,241,234,0.75)" }}>
                Thank you for subscribing.
              </p>
            ) : (
              <form
                onSubmit={onSubscribe}
                style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                  }}
                >
                  <label htmlFor="hi-newsletter-website">Website (leave this blank)</label>
                  <input
                    id="hi-newsletter-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                <input
                  required
                  type="email"
                  aria-label="Email address"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "transparent",
                    border: "1px solid rgba(244,241,234,0.24)",
                    padding: "0.6rem 0.8rem",
                    color: "#F4F1EA",
                    fontFamily: "var(--font-inter)",
                    fontSize: "0.8rem",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    // --hi-accent is decoration-only (2.87:1 under this text).
                    // Text-bearing fills use --hi-accent-strong; see the token
                    // note in globals.css.
                    background: "var(--hi-accent-strong)",
                    color: "var(--hi-on-dark)",
                    border: "none",
                    padding: "0.6rem 1rem",
                    fontFamily: "var(--font-inter)",
                    fontSize: "0.7rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Join
                </button>
                {error && (
                  <p
                    role="alert"
                    style={{
                      width: "100%",
                      fontSize: "0.78rem",
                      color: "#D98B7F",
                      marginTop: "0.15rem",
                    }}
                  >
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        <p
          style={{
            fontFamily: "var(--font-inter)",
            fontSize: "0.75rem",
            // 0.45 composited to 3.97:1 on the footer ground, under AA for
            // 12px text. 0.62 measures 6.22:1 and still reads as recessive.
            color: "rgba(244,241,234,0.62)",
            paddingTop: "1.75rem",
            textAlign: "center",
          }}
        >
          © {new Date().getFullYear()} {settings.siteName}. All rights reserved.
        </p>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .hi-footer-grid {
            grid-template-columns: 1.4fr 0.8fr 0.8fr 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
