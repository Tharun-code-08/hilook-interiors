"use client";

import { useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";
import MediaLibraryModal from "./MediaLibraryModal";
import { adminFetch } from "@/lib/admin-client";
import { Button } from "../../components/ui";

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
    const res = await adminFetch("/api/admin/media", { method: "POST", body: formData });
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
    <div className="ad-field">
      <span className="ad-label">{label}</span>

      {values.length > 0 && (
        <div className="ad-media-grid ad-media-grid--sm">
          {values.map((url, i) => (
            <div key={`${url}-${i}`} className="ad-stack-tight">
              <div className="ad-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" />
                {/* The first image is what the public card and the project
                    hero use, so it is worth naming rather than leaving the
                    operator to infer it from position. */}
                {i === 0 && <span className="ad-thumb-tag">Cover</span>}
              </div>
              <div className="ad-row ad-row--tight">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move image ${i + 1} earlier`}
                >
                  ‹
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => move(i, 1)}
                  disabled={i === values.length - 1}
                  aria-label={`Move image ${i + 1} later`}
                >
                  ›
                </Button>
                <Button
                  variant="danger-quiet"
                  size="sm"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove image ${i + 1}`}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="ad-row">
        <label className={`ad-btn ad-btn--secondary ad-btn--sm${uploading ? " is-busy" : ""}`}>
          {uploading ? "Uploading…" : "Add image"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileSelected}
            className="ad-sr"
            disabled={uploading}
          />
        </label>
        <Button variant="secondary" size="sm" onClick={() => setLibraryOpen(true)}>
          Add from library
        </Button>
      </div>

      {error && (
        <p className="ad-error" role="alert">
          {error}
        </p>
      )}

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
