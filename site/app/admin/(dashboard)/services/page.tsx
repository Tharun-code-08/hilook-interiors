"use client";

import { useEffect, useState } from "react";
import type { Service } from "@/lib/types";
import ImagePicker from "../components/ImagePicker";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { jsonBody, useMutation } from "../components/useMutation";
import {
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  TextArea,
  TextField,
} from "../../components/ui";

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ name: string; description: string; image: string | null }>({
    name: "",
    description: "",
    image: null,
  });
  const { mutate } = useMutation();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    const res = await adminFetch("/api/admin/services");
    if (res.ok) setServices((await res.json()).sort((a: Service, b: Service) => a.order - b.order));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const created = await mutate(
      "/api/admin/services",
      { method: "POST", ...jsonBody(form) },
      { successMessage: "Saved." }
    );
    if (!created) return;
    setForm({ name: "", description: "", image: null });
    load();
  }

  async function updateService(id: string, patch: Partial<Service>) {
    // Snapshot before the optimistic write so a rejected save is undone
    // rather than left on screen as though it succeeded.
    const previous = services;
    await mutate(
      `/api/admin/services/${id}`,
      { method: "PUT", ...jsonBody(patch) },
      {
        optimistic: () =>
          setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
        rollback: () => setServices(previous),
      }
    );
  }

  async function removeService(id: string) {
    const target = services.find((item) => item.id === id);
    const ok = await confirm({
      title: `Remove “${target?.name ?? "this item"}”?`,
      body: "This service will no longer appear on the public site.",
      confirmLabel: "Remove service",
      tone: "danger",
    });
    if (!ok) return;

    const previous = services;
    await mutate(
      `/api/admin/services/${id}`,
      { method: "DELETE" },
      {
        optimistic: () => setServices((prev) => prev.filter((s) => s.id !== id)),
        rollback: () => setServices(previous),
        successMessage: "Service removed.",
      }
    );
  }

  return (
    <>
      <PageHeader
        title="Services"
        description="What the studio offers. These appear in the Services section of the home page, in this order."
      />

      <div className="ad-stack-lg">
        <Card title="Add a service">
          <form onSubmit={addService} className="ad-stack">
            <TextField
              label="Name"
              placeholder="Residential interior design"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextArea
              label="Description"
              rows={3}
              placeholder="One or two sentences describing the service."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <ImagePicker
              label="Image"
              value={form.image}
              onChange={(url) => setForm({ ...form, image: url })}
            />
            <div className="ad-row">
              <Button type="submit" variant="primary" disabled={!form.name.trim()}>
                Add service
              </Button>
            </div>
          </form>
        </Card>

        {loading ? (
          <Loading />
        ) : services.length === 0 ? (
          <Card>
            <EmptyState title="No services yet">
              Add the first one above and it will appear on the home page.
            </EmptyState>
          </Card>
        ) : (
          <div className="ad-stack">
            {services.map((s) => (
              <Card key={s.id}>
                <div className="ad-stack">
                  <TextField
                    label="Name"
                    hiddenLabel
                    seamless
                    title
                    value={s.name}
                    onChange={(e) => updateService(s.id, { name: e.target.value })}
                  />
                  <TextArea
                    label="Description"
                    hiddenLabel
                    seamless
                    rows={2}
                    value={s.description}
                    onChange={(e) => updateService(s.id, { description: e.target.value })}
                  />
                  <ImagePicker
                    label="Image"
                    value={s.image}
                    onChange={(url) => updateService(s.id, { image: url })}
                  />
                  <div className="ad-row-end">
                    <Button variant="danger-quiet" size="sm" onClick={() => removeService(s.id)}>
                      Remove
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
