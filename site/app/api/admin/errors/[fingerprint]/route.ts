import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { resolveError } from "@/lib/repos/errors";

/**
 * Marks one error as dealt with.
 *
 * It is not deleted: if the same failure happens again, recordError clears the
 * resolved flag and the row comes back with its history intact. Dismissing
 * something that is still broken should be temporary, not permanent.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fingerprint: string }> }
) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const { fingerprint } = await params;
  await resolveError(fingerprint);

  await tryRecordAudit({
    actor: guard.session,
    action: "update",
    entity: "error",
    entityId: fingerprint,
    detail: "marked resolved",
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
