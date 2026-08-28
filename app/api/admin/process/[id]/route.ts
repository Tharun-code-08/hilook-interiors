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
  const step = db.data.processSteps.find((s) => s.id === id);
  if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof body.title === "string") step.title = body.title.trim();
  if (typeof body.body === "string") step.body = body.body.trim();
  if (typeof body.order === "number") step.order = body.order;

  await db.write();
  return NextResponse.json(step);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = await getDB();
  db.data.processSteps = db.data.processSteps.filter((s) => s.id !== id);
  await db.write();
  return NextResponse.json({ ok: true });
}
