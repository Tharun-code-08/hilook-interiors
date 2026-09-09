"use client";

import { useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";
import MediaLibraryModal from "./MediaLibraryModal";
import { adminFetch } from "@/lib/admin-client";
import { Button } from "../../components/ui";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await adminFetch("/api/admin/media", { method: "POST", body: formData });
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
    <div className="ad-field">
      <span className="ad-label">{label}</span>
      <div className="ad-picker">
        <div className="ad-picker-preview">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" />
          ) : (
            <span className="ad-muted">No image</span>
          )}
        </div>

        <div className="ad-stack">
          <div className="ad-row">
            {/* A label wrapping a hidden input, not a button: clicking a
                <button> cannot open the file dialog without scripting it, and
                the label does it natively and keeps keyboard access. */}
            <label className={`ad-btn ad-btn--secondary ad-btn--sm${uploading ? " is-busy" : ""}`}>
              {uploading ? "Uploading…" : "Upload"}
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
              Choose existing
            </Button>
            {value && (
              <Button variant="danger-quiet" size="sm" onClick={() => onChange(null)}>
                Remove
              </Button>
            )}
          </div>
          {error && (
            <p className="ad-error" role="alert">
              {error}
            </p>
          )}
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
