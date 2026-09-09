import { NextResponse } from "next/server";
import { summary } from "@/lib/repos/analytics";
import { submissionStats } from "@/lib/repos/operations";
import { requireSession } from "@/lib/api";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const [analytics, submissions] = await Promise.all([summary(), submissionStats()]);
  return NextResponse.json({ ...analytics, submissions });
}
