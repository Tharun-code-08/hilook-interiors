"use client";

import { useEffect, useState } from "react";
import type { PortfolioProject } from "@/lib/types";
import MultiImagePicker from "../components/MultiImagePicker";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import {
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
} from "../../components/ui";
import { jsonBody, useMutation } from "../components/useMutation";

type PortfolioForm = {
  title: string;
  category: "Residential" | "Commercial";
  description: string;
  images: string[];
};

const emptyForm: PortfolioForm = {
  title: "",
  category: "Residential",
  description: "",
  images: [],
};

export default function AdminPortfolioPage() {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PortfolioForm>(emptyForm);
  const [dragId, setDragId] = useState<string | null>(null);
  const { mutate } = useMutation();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    const res = await adminFetch("/api/admin/portfolio");
    if (res.ok)
      setProjects(
        (await res.json()).sort((a: PortfolioProject, b: PortfolioProject) => a.order - b.order)
      );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const created = await mutate<PortfolioProject>(
      "/api/admin/portfolio",
      { method: "POST", ...jsonBody(form) },
      { successMessage: `Added “${form.title.trim()}”.` }
    );
    if (created) {
      setForm(emptyForm);
      load();
    }
  }

  async function updateProject(id: string, patch: Partial<PortfolioProject>) {
    // Snapshot before the optimistic write, so a rejected save can be undone
    // rather than leaving the screen showing an edit the server refused.
    const previous = projects;
    await mutate(
      `/api/admin/portfolio/${id}`,
      { method: "PUT", ...jsonBody(patch) },
      {
        optimistic: () =>
          setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
        rollback: () => setProjects(previous),
      }
    );
  }

  async function deleteProject(id: string) {
    const project = projects.find((p) => p.id === id);
    const ok = await confirm({
      title: `Delete “${project?.title ?? "this project"}”?`,
      body: "It will be removed from the public site. Uploaded images stay in the Media Library.",
      confirmLabel: "Delete project",
      tone: "danger",
    });
    if (!ok) return;

    const previous = projects;
    await mutate(
      `/api/admin/portfolio/${id}`,
      { method: "DELETE" },
      {
        optimistic: () => setProjects((prev) => prev.filter((p) => p.id !== id)),
        rollback: () => setProjects(previous),
        successMessage: "Project deleted.",
      }
    );
  }

  async function persistOrder(next: PortfolioProject[]) {
    const previous = projects;
    await mutate(
      "/api/admin/portfolio/reorder",
      { method: "PATCH", ...jsonBody({ ids: next.map((p) => p.id) }) },
      { optimistic: () => setProjects(next), rollback: () => setProjects(previous) }
    );
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const current = [...projects];
    const fromIndex = current.findIndex((p) => p.id === dragId);
    const toIndex = current.findIndex((p) => p.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    persistOrder(current);
    setDragId(null);
  }

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Projects shown on the home page and at /work. Drag a card to reorder — the order here is the order visitors see."
      />

      <div className="ad-stack-lg">
        <Card title="Add a project">
          <form onSubmit={addProject} className="ad-stack">
            <div className="ad-grid-2">
              <TextField
                label="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <SelectField
                label="Category"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as "Residential" | "Commercial" })
                }
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
              </SelectField>
            </div>
            <TextArea
              label="Description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <MultiImagePicker
              label="Project images"
              values={form.images}
              onChange={(images) => setForm({ ...form, images })}
            />
            <div className="ad-row">
              <Button type="submit" variant="primary" disabled={!form.title.trim()}>
                Add project
              </Button>
            </div>
          </form>
        </Card>

        {loading ? (
          <Loading />
        ) : projects.length === 0 ? (
          <Card>
            <EmptyState title="No projects yet">Add your first one above.</EmptyState>
          </Card>
        ) : (
          <div className="ad-stack">
            {projects.map((p) => (
              <div
                key={p.id}
                className="ad-card ad-draggable"
                draggable
                onDragStart={() => setDragId(p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(p.id)}
              >
                <div className="ad-card-body ad-stack">
                  <div className="ad-project-head">
                    <span className="ad-grip" aria-hidden>
                      ⋮⋮
                    </span>
                    <div className="ad-stack">
                      <TextField
                        label="Title"
                        hiddenLabel
                        seamless
                        title
                        value={p.title}
                        onChange={(e) => updateProject(p.id, { title: e.target.value })}
                      />
                      <div className="ad-grid-2">
                        <SelectField
                          label="Category"
                          hiddenLabel
                          value={p.category}
                          onChange={(e) =>
                            updateProject(p.id, {
                              category: e.target.value as "Residential" | "Commercial",
                            })
                          }
                        >
                          <option value="Residential">Residential</option>
                          <option value="Commercial">Commercial</option>
                        </SelectField>
                        <TextField
                          label="Description"
                          hiddenLabel
                          seamless
                          value={p.description}
                          onChange={(e) => updateProject(p.id, { description: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button
                      variant="danger-quiet"
                      size="sm"
                      onClick={() => deleteProject(p.id)}
                      aria-label={`Delete ${p.title}`}
                    >
                      Delete
                    </Button>
                  </div>

                  <MultiImagePicker
                    label="Project images"
                    values={p.images}
                    onChange={(images) => updateProject(p.id, { images })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
