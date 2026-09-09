import { NextRequest, NextResponse } from "next/server";
import { deleteMedia } from "@/lib/repos/operations";
import { notFound, requireSession } from "@/lib/api";
import { deleteObject } from "@/lib/storage";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const removed = await deleteMedia(id);
  if (!removed) return notFound();

  // Row first, then the object: a deleted row with an orphaned object wastes
  // storage, but an orphaned row whose object is gone renders broken images.
  await deleteObject(removed.storageKey);

  await tryRecordAudit({
    actor: guard.session,
    action: "delete",
    entity: "media",
    entityId: id,
    detail: removed.filename,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
