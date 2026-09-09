import { NextRequest, NextResponse } from "next/server";
import { listReviews, createReview } from "@/lib/repos/content";
import { requireBody, requireSession } from "@/lib/api";
import { reviewCreateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json(await listReviews());
}

export async function POST(req: NextRequest) {
  const guard = await requireBody(req, reviewCreateSchema);
  if (!guard.ok) return guard.response;

  const created = await createReview(guard.data);

  await tryRecordAudit({
    actor: guard.session,
    action: "create",
    entity: "review",
    entityId: created.id,
    detail: `${created.name} (${created.rating}\u2605)`,
    ip: clientIp(req),
  });

  return NextResponse.json(created, { status: 201 });
}
