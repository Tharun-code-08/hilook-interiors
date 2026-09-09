import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDB();
  const { pageviews, sections, referrers, totalVisits } = db.data.analytics;
  return NextResponse.json({
    totalVisits,
    pageviews,
    sections,
    referrers,
    submissionsCount: db.data.submissions.length,
    unreadSubmissions: db.data.submissions.filter((s) => !s.read).length,
  });
}
