import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDB();
  const rows = [
    ["Name", "Email", "Phone", "Message", "Submitted At", "Read", "Responded"],
    ...db.data.submissions.map((s) => [
      s.name,
      s.email,
      s.phone,
      s.message,
      s.createdAt,
      s.read ? "Yes" : "No",
      s.responded ? "Yes" : "No",
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=hilook-submissions.csv",
    },
  });
}
