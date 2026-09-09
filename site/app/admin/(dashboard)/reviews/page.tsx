"use client";

import { useEffect, useState } from "react";
import type { Review } from "@/lib/types";
import ImagePicker from "../components/ImagePicker";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { jsonBody, useMutation } from "../components/useMutation";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Loading,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
} from "../../components/ui";

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
  const { mutate } = useMutation();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    const res = await adminFetch("/api/admin/reviews");
    if (res.ok) setReviews(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addReview(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.text.trim()) return;
    const created = await mutate(
      "/api/admin/reviews",
      { method: "POST", ...jsonBody(form) },
      { successMessage: "Saved." }
    );
    if (!created) return;
    setForm(emptyForm);
    load();
  }

  async function updateReview(id: string, patch: Partial<Review>) {
    // Snapshot before the optimistic write so a rejected save is undone
    // rather than left on screen as though it succeeded.
    const previous = reviews;
    await mutate(
      `/api/admin/reviews/${id}`,
      { method: "PUT", ...jsonBody(patch) },
      {
        optimistic: () =>
          setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
        rollback: () => setReviews(previous),
      }
    );
  }

  async function removeReview(id: string) {
    const target = reviews.find((item) => item.id === id);
    const ok = await confirm({
      title: `Delete the review from ${target?.name ?? "this item"}?`,
      body: "The testimonial is permanently removed.",
      confirmLabel: "Delete review",
      tone: "danger",
    });
    if (!ok) return;

    const previous = reviews;
    await mutate(
      `/api/admin/reviews/${id}`,
      { method: "DELETE" },
      {
        optimistic: () => setReviews((prev) => prev.filter((r) => r.id !== id)),
        rollback: () => setReviews(previous),
        successMessage: "Review deleted.",
      }
    );
  }

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Client testimonials. Only approved reviews appear on the public site; featured ones lead the section."
      />

      <div className="ad-stack-lg">
        <Card title="Add a review">
          <form onSubmit={addReview} className="ad-stack">
            <div className="ad-grid-2">
              <TextField
                label="Client name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <SelectField
                label="Rating"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n > 1 ? "s" : ""}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextArea
              label="Testimonial"
              rows={3}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
            />
            <ImagePicker
              label="Client photo"
              value={form.photo}
              onChange={(url) => setForm({ ...form, photo: url })}
            />
            <div className="ad-row">
              <Button
                type="submit"
                variant="primary"
                disabled={!form.name.trim() || !form.text.trim()}
              >
                Add review
              </Button>
            </div>
          </form>
        </Card>

        {loading ? (
          <Loading />
        ) : reviews.length === 0 ? (
          <Card>
            <EmptyState title="No reviews yet">
              Add the first testimonial above. Nothing is shown publicly until it is approved.
            </EmptyState>
          </Card>
        ) : (
          <div className="ad-stack">
            {reviews.map((r) => (
              <Card key={r.id}>
                <div className="ad-review">
                  <div className="ad-stack">
                    <div className="ad-row">
                      <Badge tone={r.approved ? "success" : "warn"}>
                        {r.approved ? "Approved" : "Pending"}
                      </Badge>
                      {r.featured && <Badge tone="info">Featured</Badge>}
                      <Badge>
                        {r.rating} star{r.rating > 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <TextField
                      label="Client name"
                      hiddenLabel
                      seamless
                      title
                      value={r.name}
                      onChange={(e) => updateReview(r.id, { name: e.target.value })}
                    />
                    <TextArea
                      label="Testimonial"
                      hiddenLabel
                      seamless
                      rows={3}
                      value={r.text}
                      onChange={(e) => updateReview(r.id, { text: e.target.value })}
                    />
                    <ImagePicker
                      label="Client photo"
                      value={r.photo}
                      onChange={(url) => updateReview(r.id, { photo: url })}
                    />
                  </div>

                  <div className="ad-stack ad-review-side">
                    <Checkbox
                      label="Approved"
                      checked={r.approved}
                      onChange={(e) => updateReview(r.id, { approved: e.target.checked })}
                    />
                    <Checkbox
                      label="Featured"
                      checked={r.featured}
                      onChange={(e) => updateReview(r.id, { featured: e.target.checked })}
                    />
                    <Button
                      variant="danger-quiet"
                      size="sm"
                      onClick={() => removeReview(r.id)}
                      aria-label={`Delete the review from ${r.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
