"use client";

import { useState } from "react";
import type { Submission } from "@/lib/types";
import { useConfirm } from "../components/ConfirmDialog";
import { jsonBody, useMutation } from "../components/useMutation";
import { Badge, Button, Card, EmptyState, PageHeader } from "../../components/ui";

type Tab = "inbox" | "filtered";

const REASON_LABEL: Record<string, string> = {
  honeypot: "filled a hidden field",
  timing: "submitted within 3 seconds of the page loading",
};

export default function SubmissionsAdmin({
  initial,
  total,
  shown,
  initialFlagged,
  flaggedTotal,
}: {
  initial: Submission[];
  /** Real enquiries in the table, not just what is rendered. */
  total: number;
  /** The cap each list was rendered with. */
  shown: number;
  initialFlagged: Submission[];
  flaggedTotal: number;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>(initial);
  const [flagged, setFlagged] = useState<Submission[]>(initialFlagged);
  const [tab, setTab] = useState<Tab>("inbox");
  const { mutate } = useMutation();
  const confirm = useConfirm();

  // No load() here: enquiries arrive from the public contact form, never from
  // this screen, so there is nothing to refetch after. Both lists are
  // server-rendered and mutations patch them in place.

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

  async function remove(id: string, from: Tab) {
    const list = from === "inbox" ? submissions : flagged;
    const target = list.find((item) => item.id === id);
    const ok = await confirm({
      title: `Delete the enquiry from ${target?.name ?? "this item"}?`,
      body: "This permanently removes the client's message and contact details.",
      confirmLabel: "Delete enquiry",
      tone: "danger",
    });
    if (!ok) return;

    const previousInbox = submissions;
    const previousFlagged = flagged;
    await mutate(
      `/api/admin/submissions/${id}`,
      { method: "DELETE" },
      {
        optimistic: () =>
          from === "inbox"
            ? setSubmissions((prev) => prev.filter((s) => s.id !== id))
            : setFlagged((prev) => prev.filter((s) => s.id !== id)),
        rollback: () => {
          setSubmissions(previousInbox);
          setFlagged(previousFlagged);
        },
        successMessage: "Enquiry deleted.",
      }
    );
  }

  /** Moves a filtered message into the real inbox. */
  async function restore(id: string) {
    const target = flagged.find((item) => item.id === id);
    if (!target) return;

    const previousInbox = submissions;
    const previousFlagged = flagged;
    await mutate(
      `/api/admin/submissions/${id}/unflag`,
      { method: "POST" },
      {
        optimistic: () => {
          setFlagged((prev) => prev.filter((s) => s.id !== id));
          setSubmissions((prev) =>
            [{ ...target, flagged: false, flagReason: null }, ...prev].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );
        },
        rollback: () => {
          setSubmissions(previousInbox);
          setFlagged(previousFlagged);
        },
        successMessage: "Moved to the inbox.",
      }
    );
  }

  const unread = submissions.filter((s) => !s.read).length;
  const list = tab === "inbox" ? submissions : flagged;
  const listTotal = tab === "inbox" ? total : flaggedTotal;

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

      {/* Two lists, not a filter over one. Spam is held separately so it never
          competes with real enquiries for the hundred rows this page shows. */}
      <div className="ad-tabs" role="tablist" aria-label="Enquiry lists">
        <button
          role="tab"
          aria-selected={tab === "inbox"}
          className={`ad-tab${tab === "inbox" ? " is-active" : ""}`}
          onClick={() => setTab("inbox")}
        >
          Enquiries {total > 0 && <span className="ad-tab-count">{total}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === "filtered"}
          className={`ad-tab${tab === "filtered" ? " is-active" : ""}`}
          onClick={() => setTab("filtered")}
        >
          Filtered {flaggedTotal > 0 && <span className="ad-tab-count">{flaggedTotal}</span>}
        </button>
      </div>

      {tab === "filtered" && (
        <div className="ad-banner ad-banner--info">
          <span>
            Caught by a spam check and held here rather than deleted. The checks are guesses — if
            one of these is a real client, move it to the inbox.
          </span>
        </div>
      )}

      {/* Said plainly rather than silently truncating: the export covers
          everything, this screen covers the recent end of it. */}
      {listTotal > shown && (
        <div className="ad-banner ad-banner--info">
          <span>
            Showing the {shown} most recent of {listTotal}. Export CSV for the full set.
          </span>
        </div>
      )}

      {list.length === 0 ? (
        <Card>
          <EmptyState title={tab === "inbox" ? "No enquiries yet" : "Nothing filtered"}>
            {tab === "inbox"
              ? "Messages sent through the contact form arrive here."
              : "Submissions caught by a spam check would appear here."}
          </EmptyState>
        </Card>
      ) : (
        <div className="ad-stack">
          {list.map((s) => (
            <article
              key={s.id}
              className={`ad-card ad-enquiry${s.read || s.flagged ? "" : " ad-enquiry--unread"}`}
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
                    {s.flagged ? (
                      <Badge tone="warn">
                        {s.flagReason ? REASON_LABEL[s.flagReason] : "filtered"}
                      </Badge>
                    ) : (
                      <>
                        {!s.read && <Badge tone="warn">Unread</Badge>}
                        {s.responded && <Badge tone="success">Responded</Badge>}
                      </>
                    )}
                    <time className="ad-muted" dateTime={new Date(s.createdAt).toISOString()}>
                      {new Date(s.createdAt).toLocaleString()}
                    </time>
                  </div>
                </div>

                <p className="ad-enquiry-body">{s.message}</p>

                <div className="ad-row">
                  {s.flagged ? (
                    <Button variant="primary" size="sm" onClick={() => restore(s.id)}>
                      This is a real enquiry
                    </Button>
                  ) : (
                    <>
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
                    </>
                  )}
                  <div className="ad-spacer" />
                  <Button
                    variant="danger-quiet"
                    size="sm"
                    onClick={() => remove(s.id, tab)}
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
