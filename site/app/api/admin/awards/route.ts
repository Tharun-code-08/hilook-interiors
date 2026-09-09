import { NextRequest, NextResponse } from "next/server";
import { listAwards, createAward } from "@/lib/repos/content";
import { requireBody, requireSession } from "@/lib/api";
import { awardCreateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json(await listAwards());
}

export async function POST(req: NextRequest) {
  const guard = await requireBody(req, awardCreateSchema);
  if (!guard.ok) return guard.response;

  const created = await createAward(guard.data);

  await tryRecordAudit({
    actor: guard.session,
    action: "create",
    entity: "award",
    entityId: created.id,
    detail: `${created.kind}: ${created.title}`,
    ip: clientIp(req),
  });

  return NextResponse.json(created, { status: 201 });
}
