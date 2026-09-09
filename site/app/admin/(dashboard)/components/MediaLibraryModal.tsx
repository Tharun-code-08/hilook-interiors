"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";
import { adminFetch } from "@/lib/admin-client";
import { Button, EmptyState, Loading } from "../../components/ui";

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
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div
        className="ad-modal ad-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Choose an image"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ad-card-head">
          <h2 className="ad-card-title">Choose an image</h2>
          <div className="ad-row">
            <label className={`ad-btn ad-btn--secondary ad-btn--sm${uploading ? " is-busy" : ""}`}>
              {uploading ? "Uploading…" : "Upload new"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onUpload}
                className="ad-sr"
                disabled={uploading}
              />
            </label>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              ×
            </Button>
          </div>
        </div>

        <div className="ad-card-body">
          {error && (
            <p className="ad-error" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <Loading />
          ) : media.length === 0 ? (
            <EmptyState title="No media yet">
              Use “Upload new” above to add the first image.
            </EmptyState>
          ) : (
            <div className="ad-media-grid">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="ad-thumb"
                  onClick={() => onSelect(item.url)}
                  title={item.filename}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.filename} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
