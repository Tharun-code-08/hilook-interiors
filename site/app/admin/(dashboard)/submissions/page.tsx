"use client";

import { useEffect, useState } from "react";
import type { Submission } from "@/lib/types";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { jsonBody, useMutation } from "../components/useMutation";

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { mutate } = useMutation();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    const res = await adminFetch("/api/admin/submissions");
    if (res.ok) setSubmissions(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Partial<Submission>) {
    const previous = submissions;
    await mutate(
      `/api/admin/submissions/${id}`,
      { method: "PATCH", ...jsonBody(body) },
      {
        optimistic: () =>
          setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, ...body } : s))),
        rollback: () => setSubmissions(previous),
      }
    );
  }

  async function remove(id: string) {
    const target = submissions.find((item) => item.id === id);
    const ok = await confirm({
      title: `Delete the enquiry from ${target?.name ?? "this item"}?`,
      body: "This permanently removes the client's message and contact details.",
      confirmLabel: "Delete enquiry",
      tone: "danger",
    });
    if (!ok) return;

    const previous = submissions;
    await mutate(
      `/api/admin/submissions/${id}`,
      { method: "DELETE" },
      {
        optimistic: () => setSubmissions((prev) => prev.filter((s) => s.id !== id)),
        rollback: () => setSubmissions(previous),
        successMessage: "Enquiry deleted.",
      }
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.75rem",
        }}
      >
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.6rem", color: "#26231F" }}>
          Contact Inbox
        </h1>
        {/* A real anchor, not next/link: this hits a route handler that returns
            a CSV attachment. Client-side navigation would try to render the
            response as a page instead of letting the browser download it. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/admin/submissions/export"
          style={{
            background: "#26231F",
            color: "#F4F1EA",
            padding: "0.55rem 1.1rem",
            fontSize: "0.75rem",
            textDecoration: "none",
          }}
        >
          Export CSV
        </a>
      </div>

      {loading ? (
        <p style={{ color: "#777168" }}>Loading…</p>
      ) : submissions.length === 0 ? (
        <p style={{ color: "#777168" }}>No inquiries yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {submissions.map((s) => (
            <div
              key={s.id}
              style={{
                background: "#fff",
                border: "1px solid rgba(74,63,51,0.16)",
                borderLeft: s.read ? "4px solid transparent" : "4px solid #B08A4A",
                padding: "1.1rem 1.35rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, color: "#26231F" }}>{s.name}</p>
                  <p style={{ fontSize: "0.8rem", color: "#777168" }}>
                    {s.email} {s.phone && `· ${s.phone}`}
                  </p>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#777168" }}>
                  {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              <p
                style={{
                  margin: "0.9rem 0",
                  color: "#5E5951",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                }}
              >
                {s.message}
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => patch(s.id, { read: !s.read })}
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.35rem 0.75rem",
                    border: "1px solid rgba(74,63,51,0.24)",
                    background: "transparent",
                  }}
                >
                  {s.read ? "Mark unread" : "Mark read"}
                </button>
                <button
                  onClick={() => patch(s.id, { responded: !s.responded })}
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.35rem 0.75rem",
                    border: "1px solid rgba(74,63,51,0.24)",
                    background: s.responded ? "#173F35" : "transparent",
                    color: s.responded ? "#fff" : "#26231F",
                  }}
                >
                  {s.responded ? "Responded" : "Mark responded"}
                </button>
                <button
                  onClick={() => remove(s.id)}
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.35rem 0.75rem",
                    border: "1px solid #5A2630",
                    color: "#5A2630",
                    background: "transparent",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
