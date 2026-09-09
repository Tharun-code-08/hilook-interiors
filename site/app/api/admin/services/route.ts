import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDB();
  return NextResponse.json(db.data.services);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const db = await getDB();
  const order = db.data.services.length;
  const service = {
    id: nanoid(),
    name: body.name.trim(),
    description: typeof body.description === "string" ? body.description.trim() : "",
    image: typeof body.image === "string" ? body.image : null,
    order,
  };
  db.data.services.push(service);
  await db.write();
  return NextResponse.json(service, { status: 201 });
}
