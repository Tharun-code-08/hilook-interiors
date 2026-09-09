import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Only owners can remove admin accounts" }, { status: 403 });
  }
  const { id } = await params;
  if (id === session.sub) {
    return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
  }

  const db = await getDB();
  db.data.users = db.data.users.filter((u) => u.id !== id);
  await db.write();
  return NextResponse.json({ ok: true });
}
