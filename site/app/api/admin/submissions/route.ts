import { NextResponse } from "next/server";
import { listSubmissions } from "@/lib/repos/operations";
import { requireSession } from "@/lib/api";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json(await listSubmissions());
}
