import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = await getDB();
  const project = db.data.portfolio.find((p) => p.id === id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof body.title === "string") project.title = body.title.trim();
  if (body.category === "Residential" || body.category === "Commercial") project.category = body.category;
  if (typeof body.description === "string") project.description = body.description.trim();
  if (Array.isArray(body.images)) project.images = body.images.filter((i: unknown) => typeof i === "string");
  if (typeof body.order === "number") project.order = body.order;

  await db.write();
  return NextResponse.json(project);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = await getDB();
  db.data.portfolio = db.data.portfolio.filter((p) => p.id !== id);
  await db.write();
  return NextResponse.json({ ok: true });
}
