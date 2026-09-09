import { NextRequest, NextResponse } from "next/server";
import { updateAward, deleteAward } from "@/lib/repos/content";
import { notFound, requireBody, requireSession } from "@/lib/api";
import { awardUpdateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBody(req, awardUpdateSchema);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const updated = await updateAward(id, guard.data);
  if (!updated) return notFound();

  await tryRecordAudit({
    actor: guard.session,
    action: "update",
    entity: "award",
    entityId: id,
    detail: updated.title,
    ip: clientIp(req),
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const removed = await deleteAward(id);
  if (!removed) return notFound();

  await tryRecordAudit({
    actor: guard.session,
    action: "delete",
    entity: "award",
    entityId: id,
    detail: removed.title,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
