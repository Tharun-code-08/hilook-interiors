import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDB();
  return NextResponse.json(db.data.processSteps);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const db = await getDB();
  const order = db.data.processSteps.length;
  const step = {
    id: nanoid(),
    title: body.title.trim(),
    body: typeof body.body === "string" ? body.body.trim() : "",
    order,
  };
  db.data.processSteps.push(step);
  await db.write();
  return NextResponse.json(step, { status: 201 });
}
