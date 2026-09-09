import { NextRequest, NextResponse } from "next/server";
import { updateService, deleteService } from "@/lib/repos/content";
import { notFound, requireBody, requireSession } from "@/lib/api";
import { serviceUpdateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBody(req, serviceUpdateSchema);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const updated = await updateService(id, guard.data);
  if (!updated) return notFound();

  await tryRecordAudit({
    actor: guard.session,
    action: "update",
    entity: "service",
    entityId: id,
    detail: updated.name,
    ip: clientIp(req),
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const removed = await deleteService(id);
  if (!removed) return notFound();

  await tryRecordAudit({
    actor: guard.session,
    action: "delete",
    entity: "service",
    entityId: id,
    detail: removed.name,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
