import { NextRequest, NextResponse } from "next/server";
import { listProcessSteps, createProcessStep } from "@/lib/repos/content";
import { requireBody, requireSession } from "@/lib/api";
import { processCreateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json(await listProcessSteps());
}

export async function POST(req: NextRequest) {
  const guard = await requireBody(req, processCreateSchema);
  if (!guard.ok) return guard.response;

  const created = await createProcessStep(guard.data);

  await tryRecordAudit({
    actor: guard.session,
    action: "create",
    entity: "process-step",
    entityId: created.id,
    detail: created.title,
    ip: clientIp(req),
  });

  return NextResponse.json(created, { status: 201 });
}
