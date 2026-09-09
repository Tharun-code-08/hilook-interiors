import { NextRequest, NextResponse } from "next/server";
import { allProjectIds, reorderProjects } from "@/lib/repos/content";
import { requireBody } from "@/lib/api";
import { reorderSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

/** Body: { ids: string[] } — the full list of project ids in the desired order. */
export async function PATCH(req: NextRequest) {
  const guard = await requireBody(req, reorderSchema);
  if (!guard.ok) return guard.response;

  const { ids } = guard.data;
  const known = new Set(await allProjectIds());
  const submitted = new Set(ids);

  // A partial list would leave the omitted projects holding stale positions
  // that collide with the newly assigned ones.
  if (submitted.size !== ids.length) {
    return NextResponse.json({ error: "Duplicate ids in reorder request" }, { status: 400 });
  }
  if (submitted.size !== known.size || ids.some((id) => !known.has(id))) {
    return NextResponse.json(
      { error: "Reorder must list every project exactly once. Reload and try again." },
      { status: 409 }
    );
  }

  await reorderProjects(ids);

  await tryRecordAudit({
    actor: guard.session,
    action: "reorder",
    entity: "project",
    detail: `${ids.length} projects`,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}
