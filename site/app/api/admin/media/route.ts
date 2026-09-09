import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_SIZE = 8 * 1024 * 1024; // 8MB

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDB();
  return NextResponse.json(db.data.media);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 8MB limit" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name) || "";
  const id = nanoid();
  const filename = `${id}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const db = await getDB();
  const media = {
    id,
    filename: file.name,
    url: `/uploads/${filename}`,
    kind: "image" as const,
    uploadedAt: new Date().toISOString(),
  };
  db.data.media.unshift(media);
  await db.write();

  return NextResponse.json(media, { status: 201 });
}
