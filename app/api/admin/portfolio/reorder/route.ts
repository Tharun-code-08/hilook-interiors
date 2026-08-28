import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** Body: { ids: string[] } — the full list of project ids in the desired order. */
export async function PATCH(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.ids)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = await getDB();
  const ids: string[] = body.ids;
  ids.forEach((id, index) => {
    const project = db.data.portfolio.find((p) => p.id === id);
    if (project) project.order = index;
  });
  await db.write();
  return NextResponse.json({ ok: true });
}
