import { NextRequest, NextResponse } from "next/server";
import { notFound, requireSession } from "@/lib/api";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { unflagSubmission } from "@/lib/repos/operations";

/**
 * Moves a flagged submission back into the real inbox.
 *
 * This is the point of keeping them: the spam checks are heuristics, and the
 * operator is the one who can look at a message and tell. Recorded in the
 * audit log, because a rescued enquiry becoming a client is worth being able
 * to trace back.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const updated = await unflagSubmission(id);
  if (!updated) return notFound();

  await tryRecordAudit({
    actor: guard.session,
    action: "update",
    entity: "submission",
    entityId: id,
    detail: `restored a flagged enquiry from ${updated.name}`,
    ip: clientIp(req),
  });

  return NextResponse.json(updated);
}
