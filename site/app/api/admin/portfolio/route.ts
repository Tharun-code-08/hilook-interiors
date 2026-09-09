import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/repos/content";
import { requireBody, requireSession } from "@/lib/api";
import { portfolioCreateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json(await listProjects());
}

export async function POST(req: NextRequest) {
  const guard = await requireBody(req, portfolioCreateSchema);
  if (!guard.ok) return guard.response;

  // The project row and its image rows go in one transaction — see
  // lib/repos/content.ts.
  const created = await createProject(guard.data);

  await tryRecordAudit({
    actor: guard.session,
    action: "create",
    entity: "project",
    entityId: created.id,
    detail: `${created.title} (${created.images.length} images)`,
    ip: clientIp(req),
  });

  return NextResponse.json(created, { status: 201 });
}
