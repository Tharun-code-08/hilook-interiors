"use client";

import { useEffect, useState } from "react";
import type { Service } from "@/lib/db";
import ImagePicker from "../components/ImagePicker";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  border: "1px solid rgba(74,63,51,0.2)",
  fontSize: "0.85rem",
  outline: "none",
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ name: string; description: string; image: string | null }>({
    name: "",
    description: "",
    image: null,
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/services");
    if (res.ok) setServices((await res.json()).sort((a: Service, b: Service) => a.order - b.order));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", description: "", image: null });
    load();
  }

  async function updateService(id: string, patch: Partial<Service>) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await fetch(`/api/admin/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removeService(id: string) {
    if (!confirm("Remove this service?")) return;
    setServices((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/admin/services/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem", marginBottom: "1.75rem", color: "#26231F" }}>
        Services Management
      </h1>

      <form
        onSubmit={addService}
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
        <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#26231F" }}>Add Service</p>
        <input
          placeholder="Service name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={inputStyle}
        />
        <textarea
          placeholder="Description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={inputStyle}
        />
        <ImagePicker label="Service Image" value={form.image} onChange={(url) => setForm({ ...form, image: url })} />
        <button
          type="submit"
          style={{ justifySelf: "start", background: "#B08A4A", color: "#fff", border: "none", padding: "0.6rem 1.4rem", fontSize: "0.8rem" }}
        >
          Add Service
        </button>
      </form>

      {loading ? (
        <p style={{ color: "#777168" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {services.map((s) => (
            <div key={s.id} style={{ background: "#fff", border: "1px solid rgba(74,63,51,0.16)", padding: "1rem 1.25rem" }}>
              <input
                value={s.name}
                onChange={(e) => updateService(s.id, { name: e.target.value })}
                style={{ ...inputStyle, border: "none", fontWeight: 600, marginBottom: "0.4rem", padding: "0.2rem 0" }}
              />
              <textarea
                value={s.description}
                onChange={(e) => updateService(s.id, { description: e.target.value })}
                rows={2}
                style={{ ...inputStyle, border: "none", color: "#5E5951", padding: "0.2rem 0", marginBottom: "0.5rem" }}
              />
              <div style={{ marginBottom: "0.75rem" }}>
                <ImagePicker
                  label="Image"
                  value={s.image}
                  onChange={(url) => updateService(s.id, { image: url })}
                />
              </div>
              <button
                onClick={() => removeService(s.id)}
                style={{ background: "transparent", border: "1px solid #5A2630", color: "#5A2630", padding: "0.35rem 0.75rem", fontSize: "0.72rem" }}
              >
                Remove
              </button>
            </div>
          ))}
          {services.length === 0 && <p style={{ color: "#777168" }}>No services yet.</p>}
        </div>
      )}
    </div>
  );
}
