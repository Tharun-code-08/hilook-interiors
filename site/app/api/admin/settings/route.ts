import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDB();
  return NextResponse.json(db.data.settings);
}

export async function PUT(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = await getDB();
  const allowed = Object.keys(db.data.settings) as (keyof typeof db.data.settings)[];
  for (const key of allowed) {
    if (typeof body[key] === "string") {
      (db.data.settings as Record<string, string>)[key] = body[key];
    }
  }
  await db.write();
  return NextResponse.json(db.data.settings);
}
