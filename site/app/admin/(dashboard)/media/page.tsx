"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { useMutation } from "../components/useMutation";
import { Button, Card, EmptyState, Loading, PageHeader } from "../../components/ui";

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
    <>
      <PageHeader
        title="Media library"
        description="JPEG, PNG, WebP, GIF or SVG, up to 8MB. Copy a URL to reuse an image anywhere else in the panel."
        actions={
          <label className={`ad-btn ad-btn--primary${uploading ? " is-busy" : ""}`}>
            {uploading ? "Uploading…" : "Upload image"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onUpload}
              className="ad-sr"
              disabled={uploading}
            />
          </label>
        }
      />

      {error && (
        <p className="ad-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <Loading />
      ) : media.length === 0 ? (
        <Card>
          <EmptyState title="No media yet">
            Upload the first image and it becomes available to every section.
          </EmptyState>
        </Card>
      ) : (
        <div className="ad-media-grid">
          {media.map((item) => (
            <figure key={item.id} className="ad-card ad-media-card">
              <div className="ad-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.filename} loading="lazy" />
              </div>
              <figcaption className="ad-media-meta">
                <p className="ad-media-name" title={item.filename}>
                  {item.filename}
                </p>
                <div className="ad-row ad-row--tight">
                  <Button
                    size="sm"
                    onClick={() => copyUrl(item.url)}
                    aria-label={`Copy the URL for ${item.filename}`}
                  >
                    Copy URL
                  </Button>
                  <Button
                    variant="danger-quiet"
                    size="sm"
                    onClick={() => remove(item.id)}
                    aria-label={`Delete ${item.filename}`}
                  >
                    Delete
                  </Button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
