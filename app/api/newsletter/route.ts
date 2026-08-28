import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body && typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const db = await getDB();
  if (!db.data.newsletterSubscribers.includes(email)) {
    db.data.newsletterSubscribers.push(email);
    await db.write();
  }

  return NextResponse.json({ ok: true });
}
