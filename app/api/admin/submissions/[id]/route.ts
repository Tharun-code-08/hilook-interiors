import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = await getDB();
  const submission = db.data.submissions.find((s) => s.id === id);
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof body.read === "boolean") submission.read = body.read;
  if (typeof body.responded === "boolean") submission.responded = body.responded;

  await db.write();
  return NextResponse.json(submission);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = await getDB();
  db.data.submissions = db.data.submissions.filter((s) => s.id !== id);
  await db.write();
  return NextResponse.json({ ok: true });
}
