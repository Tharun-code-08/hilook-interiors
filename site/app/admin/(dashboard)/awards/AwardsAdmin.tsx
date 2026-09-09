"use client";

import { useState } from "react";
import type { AwardItem } from "@/lib/types";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { jsonBody, useMutation } from "../components/useMutation";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SelectField,
  TextField,
} from "../../components/ui";

const emptyForm = { kind: "award" as AwardItem["kind"], title: "", detail: "", url: "" };

const KIND_LABEL: Record<AwardItem["kind"], string> = {
  award: "Award",
  press: "Press",
  certification: "Certification",
};

export default function AwardsAdmin({ initial }: { initial: AwardItem[] }) {
  const [items, setItems] = useState<AwardItem[]>(initial);
  const [form, setForm] = useState(emptyForm);
  const { mutate } = useMutation();
  const confirm = useConfirm();

  // Refetch after a create; no fetch on mount — the list is server-rendered.
  async function load() {
    const res = await adminFetch("/api/admin/awards");
    if (res.ok) setItems(await res.json());
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const created = await mutate(
      "/api/admin/awards",
      { method: "POST", ...jsonBody(form) },
      { successMessage: "Saved." }
    );
    if (!created) return;
    setForm(emptyForm);
    load();
  }

  async function remove(id: string) {
    const target = items.find((item) => item.id === id);
    const ok = await confirm({
      title: `Remove “${target?.title ?? "this item"}”?`,
      body: "This entry is removed from the recognition section.",
      confirmLabel: "Remove entry",
      tone: "danger",
    });
    if (!ok) return;

    const previous = items;
    await mutate(
      `/api/admin/awards/${id}`,
      { method: "DELETE" },
      {
        optimistic: () => setItems((prev) => prev.filter((i) => i.id !== id)),
        rollback: () => setItems(previous),
        successMessage: "Entry removed.",
      }
    );
  }

  return (
    <>
      <PageHeader
        title="Awards, press & certifications"
        description="This section only appears on the public site once you add real entries here — nothing is invented or shown by default."
      />

      <div className="ad-stack-lg">
        <Card title="Add an entry">
          <form onSubmit={add} className="ad-stack">
            <div className="ad-grid-2">
              <SelectField
                label="Type"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as AwardItem["kind"] })}
              >
                <option value="award">Award</option>
                <option value="press">Press</option>
                <option value="certification">Certification</option>
              </SelectField>
              <TextField
                label="Title"
                placeholder="Best Residential Interior"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <TextField
              label="Detail"
              hint="Publication, year, or issuing body."
              placeholder="Architectural Digest, 2025"
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
            />
            <TextField
              label="Link"
              hint="Optional. Shown as a link on the public site."
              type="url"
              placeholder="https://…"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
            <div className="ad-row">
              <Button type="submit" variant="primary" disabled={!form.title.trim()}>
                Add entry
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Entries" bodyless>
          {items.length === 0 ? (
            <EmptyState title="Nothing added yet">
              The recognition section stays hidden until there is something real to show.
            </EmptyState>
          ) : (
            <div
              className="ad-table-wrap"
              role="region"
              aria-label="Awards, press and certifications"
              tabIndex={0}
            >
              <table className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Title</th>
                    <th scope="col">Detail</th>
                    <th scope="col">
                      <span className="ad-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Badge tone={item.kind === "award" ? "info" : "neutral"}>
                          {KIND_LABEL[item.kind]}
                        </Badge>
                      </td>
                      <td className="ad-td-strong">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noreferrer noopener">
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </td>
                      <td>{item.detail || <span className="ad-muted">—</span>}</td>
                      <td className="ad-td-actions">
                        <Button
                          variant="danger-quiet"
                          size="sm"
                          onClick={() => remove(item.id)}
                          aria-label={`Remove ${item.title}`}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
