import { NextRequest, NextResponse } from "next/server";
import { deleteProject, updateProject } from "@/lib/repos/content";
import { notFound, requireBody, requireSession } from "@/lib/api";
import { portfolioUpdateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBody(req, portfolioUpdateSchema);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const updated = await updateProject(id, guard.data);
  if (!updated) return notFound();

  await tryRecordAudit({
    actor: guard.session,
    action: "update",
    entity: "project",
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
  // project_images rows go with it via ON DELETE CASCADE.
  const removed = await deleteProject(id);
  if (!removed) return notFound();

  await tryRecordAudit({
    actor: guard.session,
    action: "delete",
    entity: "project",
    entityId: id,
    detail: removed.title,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
