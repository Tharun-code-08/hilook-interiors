"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import type { Settings } from "@/lib/db";

type Status = "idle" | "submitting" | "success" | "error";

export default function ContactSection({ settings }: { settings: Settings }) {
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("success");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch {
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
              <button
                type="submit"
                className="hi-cta"
                disabled={status === "submitting"}
                style={{ justifySelf: "start", border: "none" }}
              >
                {status === "submitting" ? "Sending..." : "Send Inquiry"}
              </button>
              {status === "success" && (
                <p style={{ color: "#173F35", fontSize: "0.85rem" }}>
                  Thank you — we&rsquo;ll be in touch shortly.
                </p>
              )}
              {status === "error" && (
                <p style={{ color: "#5A2630", fontSize: "0.85rem" }}>
                  Something went wrong. Please try again.
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
                  <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="hi-label">
                    Instagram
                  </a>
                )}
                {settings.pinterestUrl && (
                  <a href={settings.pinterestUrl} target="_blank" rel="noopener noreferrer" className="hi-label">
                    Pinterest
                  </a>
                )}
                {settings.facebookUrl && (
                  <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer" className="hi-label">
                    Facebook
                  </a>
                )}
              </div>
              <div
                aria-hidden
                style={{
                  marginTop: "1rem",
                  height: 220,
                  background:
                    "linear-gradient(155deg, rgba(23,63,53,0.9), rgba(38,35,31,0.9))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(248,242,232,0.6)",
                  fontFamily: "var(--font-inter)",
                  fontSize: "0.8rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Studio Location Map
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
