"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { useMutation } from "../components/useMutation";

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const { mutate } = useMutation();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await adminFetch("/api/admin/media");
    if (res.ok) setMedia(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await adminFetch("/api/admin/media", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Upload failed");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  }

  async function remove(id: string) {
    const target = media.find((item) => item.id === id);
    const ok = await confirm({
      title: `Delete “${target?.filename ?? "this item"}”?`,
      body: "The file is permanently deleted. Any project still referencing it will show a broken image.",
      confirmLabel: "Delete file",
      tone: "danger",
    });
    if (!ok) return;

    const previous = media;
    await mutate(
      `/api/admin/media/${id}`,
      { method: "DELETE" },
      {
        optimistic: () => setMedia((prev) => prev.filter((m) => m.id !== id)),
        rollback: () => setMedia(previous),
        successMessage: "File deleted.",
      }
    );
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard access may be unavailable; the URL is still visible below
    }
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.6rem",
          marginBottom: "1.75rem",
          color: "#26231F",
        }}
      >
        Media Library
      </h1>

      <div style={{ marginBottom: "2rem" }}>
        <label
          style={{
            display: "inline-block",
            background: "#B08A4A",
            color: "#fff",
            padding: "0.7rem 1.4rem",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          {uploading ? "Uploading…" : "Upload Image"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onUpload}
            style={{ display: "none" }}
            disabled={uploading}
          />
        </label>
        {error && (
          <p style={{ color: "#5A2630", fontSize: "0.8rem", marginTop: "0.6rem" }}>{error}</p>
        )}
        <p style={{ fontSize: "0.78rem", color: "#777168", marginTop: "0.6rem" }}>
          JPEG, PNG, WebP, GIF or SVG, up to 8MB. Copy a URL below to use it in Portfolio or
          Reviews.
        </p>
      </div>

      {loading ? (
        <p style={{ color: "#777168" }}>Loading…</p>
      ) : media.length === 0 ? (
        <p style={{ color: "#777168" }}>No media uploaded yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "1rem",
          }}
        >
          {media.map((item) => (
            <div
              key={item.id}
              style={{ background: "#fff", border: "1px solid rgba(74,63,51,0.16)" }}
            >
              <div
                style={{
                  aspectRatio: "1",
                  background: `center / cover no-repeat url(${item.url})`,
                }}
              />
              <div style={{ padding: "0.6rem" }}>
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "#777168",
                    marginBottom: "0.4rem",
                    wordBreak: "break-all",
                  }}
                >
                  {item.filename}
                </p>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    onClick={() => copyUrl(item.url)}
                    style={{
                      fontSize: "0.68rem",
                      padding: "0.3rem 0.5rem",
                      border: "1px solid rgba(74,63,51,0.24)",
                      background: "transparent",
                      flex: 1,
                    }}
                  >
                    Copy URL
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    style={{
                      fontSize: "0.68rem",
                      padding: "0.3rem 0.5rem",
                      border: "1px solid #5A2630",
                      color: "#5A2630",
                      background: "transparent",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
