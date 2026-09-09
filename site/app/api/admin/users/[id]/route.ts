import { NextRequest, NextResponse } from "next/server";
import { countOwners, deleteUser, findUserById } from "@/lib/repos/operations";
import { notFound, requireSession } from "@/lib/api";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession({
    role: "owner",
    forbiddenMessage: "Only owners can remove admin accounts",
  });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (id === guard.session.sub) {
    return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
  }

  const target = await findUserById(id);
  if (!target) return notFound();

  // Removing the last owner leaves a panel nobody can administer — no way to
  // add accounts or change roles short of editing the database by hand.
  if (target.role === "owner" && (await countOwners(id)) === 0) {
    return NextResponse.json(
      { error: "This is the last owner account. Promote another owner first." },
      { status: 409 }
    );
  }

  await deleteUser(id);

  await tryRecordAudit({
    actor: guard.session,
    action: "delete",
    entity: "user",
    entityId: id,
    detail: `${target.username} (${target.role})`,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
