"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";
import { adminFetch } from "@/lib/admin-client";

export default function MediaLibraryModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminFetch("/api/admin/media")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setMedia(data);
        setLoading(false);
      });
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await adminFetch("/api/admin/media", { method: "POST", body: formData });
    if (res.ok) {
      const item: MediaItem = await res.json();
      onSelect(item.url);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error || "Upload failed");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,14,10,0.6)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#F4F1EA",
          maxWidth: 720,
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid rgba(74,63,51,0.16)",
          }}
        >
          <p style={{ fontFamily: "Georgia, serif", fontSize: "1.1rem", color: "#26231F" }}>
            Choose an Image
          </p>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <label
              style={{
                background: "#B08A4A",
                color: "#fff",
                padding: "0.4rem 0.8rem",
                fontSize: "0.72rem",
                cursor: uploading ? "default" : "pointer",
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "Uploading…" : "Upload New"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onUpload}
                style={{ display: "none" }}
                disabled={uploading}
              />
            </label>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "1.3rem",
                color: "#5E5951",
                cursor: "pointer",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {error && (
          <p style={{ color: "#5A2630", fontSize: "0.78rem", padding: "0.75rem 1.5rem 0" }}>
            {error}
          </p>
        )}

        <div style={{ padding: "1.5rem", overflowY: "auto" }}>
          {loading ? (
            <p style={{ color: "#777168" }}>Loading…</p>
          ) : media.length === 0 ? (
            <p style={{ color: "#777168" }}>
              No media uploaded yet — use &ldquo;Upload New&rdquo; above.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: "0.85rem",
              }}
            >
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.url)}
                  title={item.filename}
                  style={{
                    aspectRatio: "1",
                    background: `center / cover no-repeat url(${item.url})`,
                    border: "1px solid rgba(74,63,51,0.16)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
