"use client";

import { useEffect, useState } from "react";
import type { Review } from "@/lib/db";
import ImagePicker from "../components/ImagePicker";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  border: "1px solid rgba(74,63,51,0.2)",
  fontSize: "0.85rem",
  outline: "none",
};

const emptyForm: { name: string; text: string; rating: number; photo: string | null } = {
  name: "",
  text: "",
  rating: 5,
  photo: null,
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/reviews");
    if (res.ok) setReviews(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addReview(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.text.trim()) return;
    await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(emptyForm);
    load();
  }

  async function updateReview(id: string, patch: Partial<Review>) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await fetch(`/api/admin/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removeReview(id: string) {
    if (!confirm("Delete this review?")) return;
    setReviews((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem", marginBottom: "1.75rem", color: "#26231F" }}>
        Reviews Management
      </h1>

      <form
        onSubmit={addReview}
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
        <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#26231F" }}>Add Review</p>
        <input
          placeholder="Client name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={inputStyle}
        />
        <textarea
          placeholder="Review text"
          rows={3}
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          style={inputStyle}
        />
        <select
          value={form.rating}
          onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
          style={inputStyle}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <ImagePicker label="Client Photo" value={form.photo} onChange={(url) => setForm({ ...form, photo: url })} />
        <button
          type="submit"
          style={{ justifySelf: "start", background: "#B08A4A", color: "#fff", border: "none", padding: "0.6rem 1.4rem", fontSize: "0.8rem" }}
        >
          Add Review
        </button>
      </form>

      {loading ? (
        <p style={{ color: "#777168" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ background: "#fff", border: "1px solid rgba(74,63,51,0.16)", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <input
                    value={r.name}
                    onChange={(e) => updateReview(r.id, { name: e.target.value })}
                    style={{ ...inputStyle, border: "none", fontWeight: 600, padding: "0.2rem 0" }}
                  />
                  <textarea
                    value={r.text}
                    onChange={(e) => updateReview(r.id, { text: e.target.value })}
                    rows={2}
                    style={{ ...inputStyle, border: "none", color: "#5E5951", padding: "0.2rem 0" }}
                  />
                  <div style={{ marginTop: "0.6rem" }}>
                    <ImagePicker
                      label="Photo"
                      value={r.photo}
                      onChange={(url) => updateReview(r.id, { photo: url })}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end" }}>
                  <label style={{ fontSize: "0.72rem", color: "#777168" }}>
                    <input
                      type="checkbox"
                      checked={r.approved}
                      onChange={(e) => updateReview(r.id, { approved: e.target.checked })}
                    />{" "}
                    Approved
                  </label>
                  <label style={{ fontSize: "0.72rem", color: "#777168" }}>
                    <input
                      type="checkbox"
                      checked={r.featured}
                      onChange={(e) => updateReview(r.id, { featured: e.target.checked })}
                    />{" "}
                    Featured
                  </label>
                  <button
                    onClick={() => removeReview(r.id)}
                    style={{ background: "transparent", border: "1px solid #5A2630", color: "#5A2630", padding: "0.3rem 0.7rem", fontSize: "0.7rem" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <p style={{ color: "#777168" }}>No reviews yet.</p>}
        </div>
      )}
    </div>
  );
}
