"use client";

import { useRef, useState } from "react";
import Reveal from "./Reveal";
import type { Settings } from "@/lib/types";

type Status = "idle" | "submitting" | "success" | "error";

export default function ContactSection({ settings }: { settings: Settings }) {
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Honeypot: hidden from sighted users and from assistive tech, so a real
  // visitor never fills it. Most naive bots fill every input they find.
  const [website, setWebsite] = useState("");

  // When this form first rendered. A submission arriving within a few seconds
  // of that is almost certainly scripted; the server decides, not us.
  const startedAtRef = useRef(Date.now());

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website, startedAt: startedAtRef.current }),
      });

      if (!res.ok) {
        // The API returns a usable message now — show it rather than a
        // generic failure, so a rejected email or a rate limit is actionable.
        let message = "Something went wrong. Please try again.";
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          /* keep the fallback */
        }
        setErrorMessage(message);
        setStatus("error");
        return;
      }

      setStatus("success");
      setForm({ name: "", email: "", phone: "", message: "" });
      startedAtRef.current = Date.now();
    } catch {
      setErrorMessage("Couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid rgba(74,63,51,0.24)",
    padding: "0.75rem 0",
    fontFamily: "var(--font-inter)",
    fontWeight: 300,
    fontSize: "0.95rem",
    color: "#26231F",
    outline: "none",
  };

  return (
    <section
      id="contact"
      style={{
        padding: "clamp(5rem, 12vh, 9rem) 0",
        background: "#F4F1EA",
      }}
    >
      <div className="hi-container">
        <Reveal>
          <p className="hi-label">{settings.contactLabel}</p>
        </Reveal>

        <div
          className="hi-contact-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "3.5rem",
            marginTop: "2rem",
          }}
        >
          <Reveal index={1}>
            <form onSubmit={onSubmit} style={{ display: "grid", gap: "1.6rem" }}>
              <input
                required
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={inputStyle}
              />
              <input
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                style={inputStyle}
              />
              <textarea
                required
                placeholder="Message"
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                style={{ ...inputStyle, resize: "vertical" }}
              />

              {/* Honeypot. Hidden from sight, from the tab order, and from
                  assistive tech — a person cannot reach it, so anything in it
                  came from a script. Not display:none: some bots skip fields
                  that are obviously hidden that way. */}
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
                <label htmlFor="hi-website">Website (leave this blank)</label>
                <input
                  id="hi-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="hi-cta"
                disabled={status === "submitting"}
                style={{ justifySelf: "start", border: "none" }}
              >
                {status === "submitting" ? "Sending..." : "Send Inquiry"}
              </button>
              {status === "success" && (
                <p role="status" style={{ color: "#173F35", fontSize: "0.85rem" }}>
                  Thank you — we&rsquo;ll be in touch shortly.
                </p>
              )}
              {status === "error" && (
                <p role="alert" style={{ color: "#5A2630", fontSize: "0.85rem" }}>
                  {errorMessage ?? "Something went wrong. Please try again."}
                </p>
              )}
            </form>
          </Reveal>

          <Reveal index={2}>
            <div style={{ display: "grid", gap: "1.75rem" }}>
              <div>
                <p className="hi-label" style={{ marginBottom: "0.5rem" }}>
                  Email
                </p>
                <a
                  href={`mailto:${settings.contactEmail}`}
                  style={{ fontFamily: "var(--font-inter)", color: "#5E5951" }}
                >
                  {settings.contactEmail}
                </a>
              </div>
              <div>
                <p className="hi-label" style={{ marginBottom: "0.5rem" }}>
                  Phone
                </p>
                <a
                  href={`tel:${settings.contactPhone.replace(/\s+/g, "")}`}
                  style={{ fontFamily: "var(--font-inter)", color: "#5E5951" }}
                >
                  {settings.contactPhone}
                </a>
              </div>
              <div>
                <p className="hi-label" style={{ marginBottom: "0.5rem" }}>
                  Studio
                </p>
                <p style={{ fontFamily: "var(--font-inter)", color: "#5E5951", lineHeight: 1.7 }}>
                  {settings.contactAddress}
                </p>
              </div>
              <div style={{ display: "flex", gap: "1.1rem", marginTop: "0.5rem" }}>
                {settings.instagramUrl && (
                  <a
                    href={settings.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hi-label"
                  >
                    Instagram
                  </a>
                )}
                {settings.pinterestUrl && (
                  <a
                    href={settings.pinterestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hi-label"
                  >
                    Pinterest
                  </a>
                )}
                {settings.facebookUrl && (
                  <a
                    href={settings.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hi-label"
                  >
                    Facebook
                  </a>
                )}
              </div>
              {/* This was a 220px gradient rectangle with the words "STUDIO
                  LOCATION MAP" printed across it — a placeholder that read as
                  an unfinished page rather than a map. A real embed needs a
                  real address (still placeholder in the store) and costs a
                  third-party iframe on every load, so until there's an address
                  worth mapping, this space does something honest instead. */}
              <div
                style={{
                  marginTop: "1.25rem",
                  padding: "1.6rem",
                  background: "var(--hi-surface-alt)",
                  borderLeft: "2px solid var(--hi-accent)",
                }}
              >
                <p className="hi-label" style={{ marginBottom: "0.7rem" }}>
                  Consultations
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontSize: "1.2rem",
                    lineHeight: 1.5,
                    color: "var(--hi-ink)",
                    marginBottom: "0.9rem",
                    textWrap: "balance",
                  }}
                >
                  Every project begins with a conversation about how you want the space to feel.
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontWeight: 300,
                    fontSize: "0.9rem",
                    lineHeight: 1.7,
                    color: "var(--hi-ink-muted)",
                  }}
                >
                  Send the form and we&rsquo;ll be in touch to arrange a visit — at the studio or on
                  site.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .hi-contact-grid {
            grid-template-columns: 1.1fr 0.9fr !important;
          }
        }
      `}</style>
    </section>
  );
}
