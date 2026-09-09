import { NextRequest, NextResponse } from "next/server";
import { listSubmissions } from "@/lib/repos/operations";
import { requireSession } from "@/lib/api";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

/**
 * Quotes a CSV cell and defuses spreadsheet formula injection.
 *
 * A message beginning =, +, -, or @ is parsed as a formula by Excel and
 * Sheets; the classic vector is =HYPERLINK(...) or a DDE payload that runs on
 * open. A leading apostrophe makes the cell literal text and isn't displayed.
 */
function csvEscape(value: string) {
  const dangerous = /^[=+\-@\t\r]/.test(value);
  const safe = dangerous ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const submissions = await listSubmissions();
  const rows = [
    ["Name", "Email", "Phone", "Message", "Submitted At", "Read", "Responded"],
    ...submissions.map((s) => [
      s.name,
      s.email,
      s.phone,
      s.message,
      s.createdAt,
      s.read ? "Yes" : "No",
      s.responded ? "Yes" : "No",
    ]),
  ];

  // CRLF and a UTF-8 BOM: without the BOM, Excel on Windows renders
  // non-ASCII names as mojibake.
  const csv = "\uFEFF" + rows.map((r) => r.map((c) => csvEscape(String(c))).join(",")).join("\r\n");

  await tryRecordAudit({
    actor: guard.session,
    action: "export",
    entity: "submission",
    detail: `${submissions.length} rows`,
    ip: clientIp(req),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hilook-submissions-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
