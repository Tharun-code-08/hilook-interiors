"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/lib/db";
import ImagePicker from "../components/ImagePicker";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  border: "1px solid rgba(74,63,51,0.2)",
  fontSize: "0.85rem",
  outline: "none",
};

type Field = { key: keyof Settings; label: string; area?: boolean };

type Group = {
  title: string;
  description?: string;
  fields: Field[];
};

const GROUPS: Group[] = [
  {
    title: "Site",
    description: "Used in the browser tab, search results, and the footer.",
    fields: [
      { key: "siteName", label: "Site / Brand Name" },
      { key: "metaDescription", label: "Meta Description (for search engines)", area: true },
    ],
  },
  {
    title: "Hero",
    description: "The opening full-screen scroll sequence.",
    fields: [
      { key: "heroLabel", label: "Hero Label" },
      { key: "heroTitle", label: "Hero Title" },
      { key: "heroParagraph", label: "Hero Paragraph", area: true },
      { key: "heroCta", label: "Hero Button Text" },
    ],
  },
  {
    title: "Hero Scroll Story",
    description: "The three beats that appear as visitors scroll through the hero.",
    fields: [
      { key: "heroPhilosophyLabel", label: "Beat 1 Label" },
      { key: "heroPhilosophyText", label: "Beat 1 Text", area: true },
      { key: "heroProcessLabel", label: "Beat 2 Label" },
      { key: "heroProcessText", label: "Beat 2 Text", area: true },
      { key: "heroClosingLabel", label: "Closing Label" },
      { key: "heroClosingTitle", label: "Closing Title" },
      { key: "heroClosingCta", label: "Closing Button Text" },
    ],
  },
  {
    title: "About",
    fields: [
      { key: "aboutLabel", label: "About Section Label" },
      { key: "aboutTitle", label: "About Heading" },
      { key: "aboutBody", label: "About Body", area: true },
      { key: "aboutCredentials", label: "About Credentials", area: true },
    ],
  },
  {
    title: "Services",
    fields: [
      { key: "servicesLabel", label: "Services Section Label" },
      { key: "servicesIntro", label: "Services Intro" },
    ],
  },
  {
    title: "Other Section Labels",
    description: "The small eyebrow labels above each remaining section.",
    fields: [
      { key: "portfolioLabel", label: "Portfolio Section Label" },
      { key: "processSectionLabel", label: "Process Section Label" },
      { key: "recognitionLabel", label: "Recognition Section Label" },
      { key: "reviewsLabel", label: "Reviews Section Label" },
      { key: "contactLabel", label: "Contact Section Label" },
    ],
  },
  {
    title: "Footer",
    fields: [{ key: "footerTagline", label: "Footer Tagline" }],
  },
  {
    title: "Contact & Social",
    fields: [
      { key: "contactEmail", label: "Contact Email" },
      { key: "contactPhone", label: "Contact Phone" },
      { key: "contactAddress", label: "Contact Address", area: true },
      { key: "whatsappNumber", label: "WhatsApp Number (digits only, with country code)" },
      { key: "instagramUrl", label: "Instagram URL" },
      { key: "pinterestUrl", label: "Pinterest URL" },
      { key: "facebookUrl", label: "Facebook URL" },
    ],
  },
  {
    title: "Analytics",
    description:
      "Connects the public site to Google Analytics (GA4). Create a property at analytics.google.com, copy its Measurement ID (looks like G-XXXXXXXXXX), and paste it below. Leave blank to disable — the site's built-in dashboard analytics keep working either way.",
    fields: [{ key: "googleAnalyticsId", label: "Google Analytics Measurement ID" }],
  },
];

export default function AdminContentPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
  }

  if (!settings) return <p style={{ color: "#777168" }}>Loading…</p>;

  return (
    <div>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem", marginBottom: "0.5rem", color: "#26231F" }}>
        Content Editor
      </h1>
      <p style={{ fontSize: "0.82rem", color: "#777168", marginBottom: "2rem", maxWidth: "60ch" }}>
        Every piece of copy on the public site lives here — nothing requires a code change.
      </p>

      <form onSubmit={save} style={{ display: "grid", gap: "2.25rem", maxWidth: 640 }}>
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.05rem", color: "#26231F", marginBottom: "0.3rem" }}>
              {group.title}
            </h2>
            {group.description && (
              <p style={{ fontSize: "0.78rem", color: "#777168", marginBottom: "0.9rem" }}>{group.description}</p>
            )}
            <div style={{ display: "grid", gap: "1.1rem" }}>
              {group.fields.map((field) => (
                <div key={field.key}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#5E5951", marginBottom: "0.35rem" }}>
                    {field.label}
                  </label>
                  {field.area ? (
                    <textarea
                      rows={3}
                      value={settings[field.key]}
                      onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                      style={inputStyle}
                    />
                  ) : (
                    <input
                      value={settings[field.key]}
                      onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
              {group.title === "About" && (
                <ImagePicker
                  label="About Image"
                  value={settings.aboutImage || null}
                  onChange={(url) => setSettings({ ...settings, aboutImage: url || "" })}
                />
              )}
            </div>
          </div>
        ))}

        <button
          type="submit"
          disabled={saving}
          style={{ justifySelf: "start", background: "#B08A4A", color: "#fff", border: "none", padding: "0.7rem 1.6rem", fontSize: "0.8rem" }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <p style={{ color: "#173F35", fontSize: "0.85rem" }}>Saved.</p>}
      </form>
    </div>
  );
}
