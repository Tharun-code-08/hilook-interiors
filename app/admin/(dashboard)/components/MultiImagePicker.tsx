"use client";

import { useRef, useState } from "react";
import type { MediaItem } from "@/lib/db";
import MediaLibraryModal from "./MediaLibraryModal";

export default function MultiImagePicker({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/media", { method: "POST", body: formData });
    if (res.ok) {
      const item: MediaItem = await res.json();
      onChange([...values, item.url]);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Upload failed");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: "0.75rem", color: "#5E5951", marginBottom: "0.45rem" }}>
        {label}
      </label>

      {values.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: "0.6rem", marginBottom: "0.75rem" }}>
          {values.map((url, i) => (
            <div key={`${url}-${i}`} style={{ position: "relative" }}>
              <div
                style={{
                  aspectRatio: "1",
                  background: `center / cover no-repeat url(${url})`,
                  border: "1px solid rgba(74,63,51,0.2)",
                }}
              />
              {i === 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: 3,
                    background: "rgba(20,16,12,0.65)",
                    color: "#F8F2E8",
                    fontSize: "0.58rem",
                    padding: "0.1rem 0.35rem",
                  }}
                >
                  Cover
                </span>
              )}
              <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.3rem" }}>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="Move earlier"
                  style={{ flex: 1, fontSize: "0.62rem", padding: "0.15rem", border: "1px solid rgba(74,63,51,0.24)", background: "transparent", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.4 : 1 }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === values.length - 1}
                  title="Move later"
                  style={{ flex: 1, fontSize: "0.62rem", padding: "0.15rem", border: "1px solid rgba(74,63,51,0.24)", background: "transparent", cursor: i === values.length - 1 ? "default" : "pointer", opacity: i === values.length - 1 ? 0.4 : 1 }}
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  title="Remove"
                  style={{ flex: 1, fontSize: "0.62rem", padding: "0.15rem", border: "1px solid #5A2630", color: "#5A2630", background: "transparent", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-block",
            background: "#B08A4A",
            color: "#fff",
            padding: "0.4rem 0.8rem",
            fontSize: "0.72rem",
            cursor: uploading ? "default" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "Uploading…" : "Add Image"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileSelected}
            style={{ display: "none" }}
            disabled={uploading}
          />
        </label>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          style={{ background: "transparent", border: "1px solid rgba(74,63,51,0.24)", color: "#26231F", padding: "0.4rem 0.8rem", fontSize: "0.72rem", cursor: "pointer" }}
        >
          Add from Library
        </button>
      </div>
      {error && <p style={{ color: "#5A2630", fontSize: "0.72rem", marginTop: "0.4rem" }}>{error}</p>}

      {libraryOpen && (
        <MediaLibraryModal
          onClose={() => setLibraryOpen(false)}
          onSelect={(url) => {
            onChange([...values, url]);
            setLibraryOpen(false);
          }}
        />
      )}
    </div>
  );
}
