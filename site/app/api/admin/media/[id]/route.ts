import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { unlink } from "fs/promises";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const db = await getDB();
  const item = db.data.media.find((m) => m.id === id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = path.join(process.cwd(), "public", item.url);
  await unlink(filePath).catch(() => {});

  db.data.media = db.data.media.filter((m) => m.id !== id);
  await db.write();
  return NextResponse.json({ ok: true });
}
