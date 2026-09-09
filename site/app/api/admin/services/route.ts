import { NextRequest, NextResponse } from "next/server";
import { listServices, createService } from "@/lib/repos/content";
import { requireBody, requireSession } from "@/lib/api";
import { serviceCreateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json(await listServices());
}

export async function POST(req: NextRequest) {
  const guard = await requireBody(req, serviceCreateSchema);
  if (!guard.ok) return guard.response;

  const created = await createService(guard.data);

  await tryRecordAudit({
    actor: guard.session,
    action: "create",
    entity: "service",
    entityId: created.id,
    detail: created.name,
    ip: clientIp(req),
  });

  return NextResponse.json(created, { status: 201 });
}
