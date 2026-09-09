"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/lib/types";
import ImagePicker from "../components/ImagePicker";
import { adminFetch } from "@/lib/admin-client";
import { jsonBody, useMutation } from "../components/useMutation";
import { Button, Card, Loading, PageHeader, TextArea, TextField } from "../../components/ui";

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
  const { mutate } = useMutation();

  useEffect(() => {
    adminFetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);

    // This one previously set `saved` unconditionally — a rejected save (an
    // invalid GA id, a malformed social URL) still showed "Saved", and the
    // operator had no way to know the copy on the live site hadn't changed.
    const result = await mutate<Settings>(
      "/api/admin/settings",
      { method: "PUT", ...jsonBody(settings) },
      { successMessage: "Content saved." }
    );

    setSaving(false);
    if (result) {
      // Adopt the server's canonical version rather than assuming ours won.
      setSettings(result);
      setSaved(true);
    }
  }

  if (!settings) return <Loading />;

  return (
    <>
      <PageHeader
        title="Text & contact"
        description="Every piece of copy on the public site lives here — nothing requires a code change."
        actions={
          <Button type="submit" form="content-form" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      <form id="content-form" onSubmit={save} className="ad-stack-lg">
        {GROUPS.map((group) => (
          <Card key={group.title} title={group.title} description={group.description}>
            <div className="ad-stack">
              {group.fields.map((field) =>
                field.area ? (
                  <TextArea
                    key={field.key}
                    label={field.label}
                    rows={3}
                    value={settings[field.key]}
                    onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                  />
                ) : (
                  <TextField
                    key={field.key}
                    label={field.label}
                    value={settings[field.key]}
                    onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                  />
                )
              )}
              {group.title === "About" && (
                <ImagePicker
                  label="About image"
                  value={settings.aboutImage || null}
                  onChange={(url) => setSettings({ ...settings, aboutImage: url || "" })}
                />
              )}
            </div>
          </Card>
        ))}

        {/* Repeated at the foot as well as the header: this form is long
            enough that the header button is off screen by the time you finish
            editing the last group. */}
        <div className="ad-row">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved && <span className="ad-saved">Saved.</span>}
        </div>
      </form>
    </>
  );
}
