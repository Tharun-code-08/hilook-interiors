"use client";

import { useEffect, useState } from "react";
import type { Submission } from "@/lib/types";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { jsonBody, useMutation } from "../components/useMutation";
import { Badge, Button, Card, EmptyState, Loading, PageHeader } from "../../components/ui";

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

  const unread = submissions.filter((s) => !s.read).length;

  return (
    <>
      <PageHeader
        title="Inbox"
        description={
          unread > 0
            ? `${unread} unread ${unread === 1 ? "enquiry" : "enquiries"} from the contact form.`
            : "Enquiries from the contact form on the public site."
        }
        actions={
          /* A real anchor, not next/link: this hits a route handler that
             returns a CSV attachment. Client-side navigation would try to
             render the response as a page instead of letting the browser
             download it. */
          /* eslint-disable-next-line @next/next/no-html-link-for-pages */
          <a className="ad-btn ad-btn--secondary" href="/api/admin/submissions/export">
            Export CSV
          </a>
        }
      />

      {loading ? (
        <Loading />
      ) : submissions.length === 0 ? (
        <Card>
          <EmptyState title="No enquiries yet">
            Messages sent through the contact form arrive here.
          </EmptyState>
        </Card>
      ) : (
        <div className="ad-stack">
          {submissions.map((s) => (
            <article
              key={s.id}
              className={`ad-card ad-enquiry${s.read ? "" : " ad-enquiry--unread"}`}
            >
              <div className="ad-card-body ad-stack">
                <div className="ad-row">
                  <div>
                    <div className="ad-td-strong">{s.name}</div>
                    <div className="ad-muted">
                      <a href={`mailto:${s.email}`}>{s.email}</a>
                      {s.phone && (
                        <>
                          {" · "}
                          <a href={`tel:${s.phone}`}>{s.phone}</a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ad-spacer" />
                  <div className="ad-row">
                    {!s.read && <Badge tone="warn">Unread</Badge>}
                    {s.responded && <Badge tone="success">Responded</Badge>}
                    <time className="ad-muted" dateTime={new Date(s.createdAt).toISOString()}>
                      {new Date(s.createdAt).toLocaleString()}
                    </time>
                  </div>
                </div>

                <p className="ad-enquiry-body">{s.message}</p>

                <div className="ad-row">
                  <Button size="sm" onClick={() => patch(s.id, { read: !s.read })}>
                    {s.read ? "Mark unread" : "Mark read"}
                  </Button>
                  <Button
                    size="sm"
                    variant={s.responded ? "primary" : "secondary"}
                    onClick={() => patch(s.id, { responded: !s.responded })}
                  >
                    {s.responded ? "Responded" : "Mark responded"}
                  </Button>
                  <div className="ad-spacer" />
                  <Button
                    variant="danger-quiet"
                    size="sm"
                    onClick={() => remove(s.id)}
                    aria-label={`Delete the enquiry from ${s.name}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
