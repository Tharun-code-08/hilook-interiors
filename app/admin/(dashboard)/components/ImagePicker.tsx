"use client";

import { useRef, useState } from "react";
import type { MediaItem } from "@/lib/db";
import MediaLibraryModal from "./MediaLibraryModal";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/admin/media", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload failed");
  }
  const media: MediaItem = await res.json();
  return media.url;
}

export default function ImagePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
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
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: "0.75rem", color: "#5E5951", marginBottom: "0.45rem" }}>
        {label}
      </label>
      <div style={{ display: "flex", gap: "0.9rem", alignItems: "flex-start" }}>
        <div
          style={{
            width: 84,
            height: 84,
            flexShrink: 0,
            background: value
              ? `center / cover no-repeat url(${value})`
              : "#EFEAE0",
            border: "1px solid rgba(74,63,51,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {!value && <span style={{ fontSize: "0.62rem", color: "#A6A093" }}>No image</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
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
              {uploading ? "Uploading…" : "Upload"}
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
              style={{
                background: "transparent",
                border: "1px solid rgba(74,63,51,0.24)",
                color: "#26231F",
                padding: "0.4rem 0.8rem",
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
            >
              Choose Existing
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                style={{
                  background: "transparent",
                  border: "1px solid #5A2630",
                  color: "#5A2630",
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            )}
          </div>
          {error && <p style={{ color: "#5A2630", fontSize: "0.72rem" }}>{error}</p>}
        </div>
      </div>

      {libraryOpen && (
        <MediaLibraryModal
          onClose={() => setLibraryOpen(false)}
          onSelect={(url) => {
            onChange(url);
            setLibraryOpen(false);
          }}
        />
      )}
    </div>
  );
}
