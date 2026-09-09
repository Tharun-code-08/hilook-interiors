import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDB();
  return NextResponse.json(db.data.portfolio);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const db = await getDB();
  const project = {
    id: nanoid(),
    title: body.title.trim(),
    category: body.category === "Commercial" ? ("Commercial" as const) : ("Residential" as const),
    description: typeof body.description === "string" ? body.description.trim() : "",
    images: Array.isArray(body.images) ? body.images.filter((i: unknown) => typeof i === "string") : [],
    order: db.data.portfolio.length,
  };
  db.data.portfolio.push(project);
  await db.write();
  return NextResponse.json(project, { status: 201 });
}
