import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDB();
  return NextResponse.json(
    db.data.users.map((u) => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Only owners can add admin accounts" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const username = body && typeof body.username === "string" ? body.username.trim() : "";
  const password = body && typeof body.password === "string" ? body.password : "";
  if (!username || password.length < 8) {
    return NextResponse.json(
      { error: "Username is required and password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = await getDB();
  if (db.data.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }

  const user = {
    id: nanoid(),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: body.role === "editor" ? ("editor" as const) : ("owner" as const),
    createdAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  await db.write();

  return NextResponse.json({ id: user.id, username: user.username, role: user.role }, { status: 201 });
}
