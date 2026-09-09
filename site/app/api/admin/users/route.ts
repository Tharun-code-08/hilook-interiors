import { NextRequest, NextResponse } from "next/server";
import { createUser, listUsers } from "@/lib/repos/operations";
import { requireBody, requireSession } from "@/lib/api";
import { userCreateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  // Never includes passwordHash — the repository strips it.
  return NextResponse.json(await listUsers());
}

export async function POST(req: NextRequest) {
  const guard = await requireBody(req, userCreateSchema, {
    role: "owner",
    forbiddenMessage: "Only owners can add admin accounts",
  });
  if (!guard.ok) return guard.response;

  // Uniqueness is enforced by a case-insensitive index, not a prior SELECT —
  // checking first leaves a window where two concurrent creates both pass.
  const result = await createUser(guard.data);
  if (!result.ok) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  await tryRecordAudit({
    actor: guard.session,
    action: "create",
    entity: "user",
    entityId: result.user.id,
    detail: `${result.user.username} (${result.user.role})`,
    ip: clientIp(req),
  });

  return NextResponse.json(result.user, { status: 201 });
}
