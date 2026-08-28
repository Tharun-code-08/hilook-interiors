"use client";

import { useEffect, useState } from "react";
import type { AwardItem } from "@/lib/db";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  border: "1px solid rgba(74,63,51,0.2)",
  fontSize: "0.85rem",
  outline: "none",
};

const emptyForm = { kind: "award" as AwardItem["kind"], title: "", detail: "", url: "" };

export default function AdminAwardsPage() {
  const [items, setItems] = useState<AwardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/awards");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await fetch("/api/admin/awards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(emptyForm);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this entry?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/admin/awards/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem", marginBottom: "0.6rem", color: "#26231F" }}>
        Awards, Press & Certifications
      </h1>
      <p style={{ fontSize: "0.85rem", color: "#777168", marginBottom: "1.75rem", maxWidth: "60ch" }}>
        This section only appears on the public site once you add real entries here — nothing is
        invented or shown by default.
      </p>

      <form
        onSubmit={add}
        style={{
          background: "#fff",
          border: "1px solid rgba(74,63,51,0.16)",
          padding: "1.5rem",
          marginBottom: "2rem",
          display: "grid",
          gap: "0.8rem",
          maxWidth: 560,
        }}
      >
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AwardItem["kind"] })} style={inputStyle}>
          <option value="award">Award</option>
          <option value="press">Press</option>
          <option value="certification">Certification</option>
        </select>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="Detail (publication, year, issuer...)"
          value={form.detail}
          onChange={(e) => setForm({ ...form, detail: e.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="Link (optional)"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          style={inputStyle}
        />
        <button
          type="submit"
          style={{ justifySelf: "start", background: "#B08A4A", color: "#fff", border: "none", padding: "0.6rem 1.4rem", fontSize: "0.8rem" }}
        >
          Add Entry
        </button>
      </form>

      {loading ? (
        <p style={{ color: "#777168" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "#777168" }}>Nothing added yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {items.map((item) => (
            <div key={item.id} style={{ background: "#fff", border: "1px solid rgba(74,63,51,0.16)", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#B08A4A" }}>{item.kind}</p>
                <p style={{ color: "#26231F" }}>{item.title}</p>
                {item.detail && <p style={{ fontSize: "0.8rem", color: "#777168" }}>{item.detail}</p>}
              </div>
              <button
                onClick={() => remove(item.id)}
                style={{ background: "transparent", border: "1px solid #5A2630", color: "#5A2630", padding: "0.35rem 0.75rem", fontSize: "0.72rem" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
