"use client";

import { useEffect, useState } from "react";
import type { PortfolioProject } from "@/lib/db";
import MultiImagePicker from "../components/MultiImagePicker";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  border: "1px solid rgba(74,63,51,0.2)",
  fontSize: "0.85rem",
  outline: "none",
};

type PortfolioForm = {
  title: string;
  category: "Residential" | "Commercial";
  description: string;
  images: string[];
};

const emptyForm: PortfolioForm = { title: "", category: "Residential", description: "", images: [] };

export default function AdminPortfolioPage() {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PortfolioForm>(emptyForm);
  const [dragId, setDragId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/portfolio");
    if (res.ok) setProjects((await res.json()).sort((a: PortfolioProject, b: PortfolioProject) => a.order - b.order));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await fetch("/api/admin/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        category: form.category,
        description: form.description,
        images: form.images,
      }),
    });
    setForm(emptyForm);
    load();
  }

  async function updateProject(id: string, patch: Partial<PortfolioProject>) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await fetch(`/api/admin/portfolio/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project?")) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/admin/portfolio/${id}`, { method: "DELETE" });
  }

  async function persistOrder(next: PortfolioProject[]) {
    setProjects(next);
    await fetch("/api/admin/portfolio/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((p) => p.id) }),
    });
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const current = [...projects];
    const fromIndex = current.findIndex((p) => p.id === dragId);
    const toIndex = current.findIndex((p) => p.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    persistOrder(current);
    setDragId(null);
  }

  return (
    <div>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem", marginBottom: "1.75rem", color: "#26231F" }}>
        Portfolio Management
      </h1>

      <form
        onSubmit={addProject}
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
        <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#26231F" }}>Add Project</p>
        <input
          placeholder="Project title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          style={inputStyle}
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value as "Residential" | "Commercial" })}
          style={inputStyle}
        >
          <option value="Residential">Residential</option>
          <option value="Commercial">Commercial</option>
        </select>
        <textarea
          placeholder="Description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={inputStyle}
        />
        <MultiImagePicker
          label="Project Images"
          values={form.images}
          onChange={(images) => setForm({ ...form, images })}
        />
        <button
          type="submit"
          style={{ justifySelf: "start", background: "#B08A4A", color: "#fff", border: "none", padding: "0.6rem 1.4rem", fontSize: "0.8rem" }}
        >
          Add Project
        </button>
      </form>

      {loading ? (
        <p style={{ color: "#777168" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {projects.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(p.id)}
              style={{
                background: "#fff",
                border: "1px solid rgba(74,63,51,0.16)",
                padding: "1rem 1.25rem",
                cursor: "grab",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr auto",
                  alignItems: "center",
                  gap: "1rem",
                  marginBottom: "0.9rem",
                }}
              >
                <span style={{ color: "#B08A4A", fontSize: "1rem" }} aria-hidden>
                  ⋮⋮
                </span>
                <div>
                  <input
                    value={p.title}
                    onChange={(e) => updateProject(p.id, { title: e.target.value })}
                    style={{ ...inputStyle, border: "none", padding: "0.2rem 0", fontWeight: 600, marginBottom: "0.2rem" }}
                  />
                  <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                    <select
                      value={p.category}
                      onChange={(e) => updateProject(p.id, { category: e.target.value as "Residential" | "Commercial" })}
                      style={{ fontSize: "0.75rem" }}
                    >
                      <option value="Residential">Residential</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                    <input
                      value={p.description}
                      onChange={(e) => updateProject(p.id, { description: e.target.value })}
                      style={{ ...inputStyle, fontSize: "0.78rem", border: "none", color: "#777168" }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => deleteProject(p.id)}
                  style={{ background: "transparent", border: "1px solid #5A2630", color: "#5A2630", padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
                >
                  Delete
                </button>
              </div>
              <MultiImagePicker
                label="Project Images"
                values={p.images}
                onChange={(images) => updateProject(p.id, { images })}
              />
            </div>
          ))}
          {projects.length === 0 && <p style={{ color: "#777168" }}>No projects yet — add your first one above.</p>}
        </div>
      )}
    </div>
  );
}
