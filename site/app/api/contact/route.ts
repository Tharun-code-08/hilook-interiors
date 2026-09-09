import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDB } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { name, email, phone, message } = body as Record<string, unknown>;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = await getDB();
  db.data.submissions.unshift({
    id: nanoid(),
    name: name.trim(),
    email: email.trim(),
    phone: typeof phone === "string" ? phone.trim() : "",
    message: message.trim(),
    createdAt: new Date().toISOString(),
    read: false,
    responded: false,
  });
  await db.write();

  return NextResponse.json({ ok: true });
}
