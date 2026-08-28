import { NextRequest, NextResponse } from "next/server";
import { recordSectionView } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const section = body && typeof body.section === "string" ? body.section : null;
  if (!section) {
    return NextResponse.json({ error: "Missing section" }, { status: 400 });
  }
  await recordSectionView(section);
  return NextResponse.json({ ok: true });
}
