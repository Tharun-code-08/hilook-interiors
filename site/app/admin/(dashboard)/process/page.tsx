"use client";

import { useEffect, useState } from "react";
import type { ProcessStep } from "@/lib/db";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  border: "1px solid rgba(74,63,51,0.2)",
  fontSize: "0.85rem",
  outline: "none",
};

export default function AdminProcessPage() {
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", body: "" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/process");
    if (res.ok) setSteps((await res.json()).sort((a: ProcessStep, b: ProcessStep) => a.order - b.order));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addStep(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await fetch("/api/admin/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ title: "", body: "" });
    load();
  }

  async function updateStep(id: string, patch: Partial<ProcessStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await fetch(`/api/admin/process/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removeStep(id: string) {
    if (!confirm("Remove this step?")) return;
    setSteps((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/admin/process/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem", marginBottom: "0.5rem", color: "#26231F" }}>
        Process Steps
      </h1>
      <p style={{ fontSize: "0.82rem", color: "#777168", marginBottom: "1.75rem", maxWidth: "60ch" }}>
        Powers the &ldquo;How We Work&rdquo; section on the public site. Steps are numbered
        automatically in the order they appear here.
      </p>

      <form
        onSubmit={addStep}
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
        <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#26231F" }}>Add Step</p>
        <input
          placeholder="Step title (e.g. Consultation)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          style={inputStyle}
        />
        <textarea
          placeholder="Description"
          rows={3}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          style={inputStyle}
        />
        <button
          type="submit"
          style={{ justifySelf: "start", background: "#B08A4A", color: "#fff", border: "none", padding: "0.6rem 1.4rem", fontSize: "0.8rem" }}
        >
          Add Step
        </button>
      </form>

      {loading ? (
        <p style={{ color: "#777168" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {steps.map((s, i) => (
            <div key={s.id} style={{ background: "#fff", border: "1px solid rgba(74,63,51,0.16)", padding: "1rem 1.25rem" }}>
              <p style={{ fontSize: "0.7rem", color: "#B08A4A", marginBottom: "0.4rem" }}>
                Step {String(i + 1).padStart(2, "0")}
              </p>
              <input
                value={s.title}
                onChange={(e) => updateStep(s.id, { title: e.target.value })}
                style={{ ...inputStyle, border: "none", fontWeight: 600, marginBottom: "0.4rem", padding: "0.2rem 0" }}
              />
              <textarea
                value={s.body}
                onChange={(e) => updateStep(s.id, { body: e.target.value })}
                rows={2}
                style={{ ...inputStyle, border: "none", color: "#5E5951", padding: "0.2rem 0", marginBottom: "0.5rem" }}
              />
              <button
                onClick={() => removeStep(s.id)}
                style={{ background: "transparent", border: "1px solid #5A2630", color: "#5A2630", padding: "0.35rem 0.75rem", fontSize: "0.72rem" }}
              >
                Remove
              </button>
            </div>
          ))}
          {steps.length === 0 && <p style={{ color: "#777168" }}>No steps yet.</p>}
        </div>
      )}
    </div>
  );
}
