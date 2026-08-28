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
  const svc = db.data.services.find((s) => s.id === id);
  if (!svc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof body.name === "string") svc.name = body.name.trim();
  if (typeof body.description === "string") svc.description = body.description.trim();
  if (typeof body.image === "string" || body.image === null) svc.image = body.image;
  if (typeof body.order === "number") svc.order = body.order;

  await db.write();
  return NextResponse.json(svc);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = await getDB();
  db.data.services = db.data.services.filter((s) => s.id !== id);
  await db.write();
  return NextResponse.json({ ok: true });
}
