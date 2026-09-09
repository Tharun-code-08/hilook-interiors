"use client";

import { useEffect, useState } from "react";
import type { ProcessStep } from "@/lib/types";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { jsonBody, useMutation } from "../components/useMutation";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  TextArea,
  TextField,
} from "../../components/ui";

export default function AdminProcessPage() {
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", body: "" });
  const { mutate } = useMutation();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    const res = await adminFetch("/api/admin/process");
    if (res.ok)
      setSteps((await res.json()).sort((a: ProcessStep, b: ProcessStep) => a.order - b.order));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addStep(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const created = await mutate(
      "/api/admin/process",
      { method: "POST", ...jsonBody(form) },
      { successMessage: "Saved." }
    );
    if (!created) return;
    setForm({ title: "", body: "" });
    load();
  }

  async function updateStep(id: string, patch: Partial<ProcessStep>) {
    // Snapshot before the optimistic write so a rejected save is undone
    // rather than left on screen as though it succeeded.
    const previous = steps;
    await mutate(
      `/api/admin/process/${id}`,
      { method: "PUT", ...jsonBody(patch) },
      {
        optimistic: () =>
          setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
        rollback: () => setSteps(previous),
      }
    );
  }

  async function removeStep(id: string) {
    const target = steps.find((item) => item.id === id);
    const ok = await confirm({
      title: `Remove the “${target?.title ?? "this item"}” step?`,
      body: "This step will no longer appear in the process section.",
      confirmLabel: "Remove step",
      tone: "danger",
    });
    if (!ok) return;

    const previous = steps;
    await mutate(
      `/api/admin/process/${id}`,
      { method: "DELETE" },
      {
        optimistic: () => setSteps((prev) => prev.filter((s) => s.id !== id)),
        rollback: () => setSteps(previous),
        successMessage: "Step removed.",
      }
    );
  }

  return (
    <>
      <PageHeader
        title="Process steps"
        description="Powers the “How We Work” section on the public site. Steps are numbered automatically in the order they appear here."
      />

      <div className="ad-stack-lg">
        <Card title="Add a step">
          <form onSubmit={addStep} className="ad-stack">
            <TextField
              label="Title"
              placeholder="Consultation"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextArea
              label="Description"
              rows={3}
              placeholder="What happens at this stage."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            <div className="ad-row">
              <Button type="submit" variant="primary" disabled={!form.title.trim()}>
                Add step
              </Button>
            </div>
          </form>
        </Card>

        {loading ? (
          <Loading />
        ) : steps.length === 0 ? (
          <Card>
            <EmptyState title="No steps yet">
              Add the first one above to build out the process section.
            </EmptyState>
          </Card>
        ) : (
          <div className="ad-stack">
            {steps.map((step, index) => (
              <Card key={step.id}>
                <div className="ad-stack">
                  <div className="ad-row">
                    {/* The number the public site renders, shown here so the
                        order on screen matches the order a visitor sees. */}
                    <Badge>Step {String(index + 1).padStart(2, "0")}</Badge>
                  </div>
                  <TextField
                    label="Title"
                    hiddenLabel
                    seamless
                    title
                    value={step.title}
                    onChange={(e) => updateStep(step.id, { title: e.target.value })}
                  />
                  <TextArea
                    label="Description"
                    hiddenLabel
                    seamless
                    rows={2}
                    value={step.body}
                    onChange={(e) => updateStep(step.id, { body: e.target.value })}
                  />
                  <div className="ad-row-end">
                    <Button variant="danger-quiet" size="sm" onClick={() => removeStep(step.id)}>
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
