import { NextRequest, NextResponse } from "next/server";
import { deleteSubmission, updateSubmission } from "@/lib/repos/operations";
import { notFound, requireBody, requireSession } from "@/lib/api";
import { submissionUpdateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBody(req, submissionUpdateSchema);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const updated = await updateSubmission(id, guard.data);
  if (!updated) return notFound();
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const removed = await deleteSubmission(id);
  if (!removed) return notFound();

  // Deleting an enquiry destroys a potential client record — worth an audit
  // entry even though marking it read is not.
  await tryRecordAudit({
    actor: guard.session,
    action: "delete",
    entity: "submission",
    entityId: id,
    detail: `${removed.name} <${removed.email}>`,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
