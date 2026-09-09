import { NextRequest, NextResponse } from "next/server";
import { notFound, requireSession } from "@/lib/api";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { findLiveSession, revokeSession } from "@/lib/repos/sessions";

/** Ends one session belonging to the caller. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const target = await findLiveSession(id);

  // Ownership is checked before existence is admitted: replying "not found"
  // for someone else's live session keeps this from confirming which ids are
  // real to a caller who should not know either way.
  if (!target || target.userId !== guard.session.sub) return notFound();

  await revokeSession(id);

  await tryRecordAudit({
    actor: guard.session,
    action: "session.revoke",
    entity: "session",
    entityId: id,
    detail: id === guard.session.jti ? "signed out of this device" : "signed out another device",
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
