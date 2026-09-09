import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { listLiveSessions, revokeAllForUser } from "@/lib/repos/sessions";

/**
 * The signed-in operator's own sessions.
 *
 * Scoped to the caller on purpose, for both verbs. An owner can already end
 * someone else's access by removing their account; letting them enumerate
 * another person's devices, addresses and activity times is a different thing
 * and not something this panel needs.
 */

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const rows = await listLiveSessions(guard.session.sub);

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      createdAt: new Date(row.createdAt).toISOString(),
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
      expiresAt: new Date(row.expiresAt).toISOString(),
      userAgent: row.userAgent,
      ip: row.ip,
      /** Lets the UI label the row rather than offer to revoke it blindly. */
      current: row.id === guard.session.jti,
    }))
  );
}

/** Ends every session except the one making the request. */
export async function DELETE(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const current = guard.session.jti;
  const ended = await revokeAllForUser(guard.session.sub, current);

  await tryRecordAudit({
    actor: guard.session,
    action: "session.revoke",
    entity: "session",
    detail: `signed out ${ended} other session(s)`,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true, ended });
}
