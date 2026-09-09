import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDB();
  return NextResponse.json(db.data.awards);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const db = await getDB();
  const item = {
    id: nanoid(),
    kind: (["award", "press", "certification"] as const).includes(body.kind) ? body.kind : ("award" as const),
    title: body.title.trim(),
    detail: typeof body.detail === "string" ? body.detail.trim() : "",
    url: typeof body.url === "string" && body.url.trim() ? body.url.trim() : null,
  };
  db.data.awards.push(item);
  await db.write();
  return NextResponse.json(item, { status: 201 });
}
