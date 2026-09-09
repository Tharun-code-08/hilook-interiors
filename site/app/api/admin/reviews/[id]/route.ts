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
  const review = db.data.reviews.find((r) => r.id === id);
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof body.name === "string") review.name = body.name.trim();
  if (typeof body.text === "string") review.text = body.text.trim();
  if (typeof body.photo === "string" || body.photo === null) review.photo = body.photo;
  if (typeof body.rating === "number") review.rating = Math.min(5, Math.max(1, body.rating));
  if (typeof body.approved === "boolean") review.approved = body.approved;
  if (typeof body.featured === "boolean") review.featured = body.featured;

  await db.write();
  return NextResponse.json(review);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = await getDB();
  db.data.reviews = db.data.reviews.filter((r) => r.id !== id);
  await db.write();
  return NextResponse.json({ ok: true });
}
