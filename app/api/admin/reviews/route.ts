import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDB();
  return NextResponse.json(db.data.reviews);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim() || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Name and review text are required" }, { status: 400 });
  }

  const db = await getDB();
  const review = {
    id: nanoid(),
    name: body.name.trim(),
    photo: typeof body.photo === "string" ? body.photo : null,
    rating: typeof body.rating === "number" ? Math.min(5, Math.max(1, body.rating)) : 5,
    text: body.text.trim(),
    approved: Boolean(body.approved ?? true),
    featured: Boolean(body.featured ?? false),
    order: db.data.reviews.length,
  };
  db.data.reviews.push(review);
  await db.write();
  return NextResponse.json(review, { status: 201 });
}
