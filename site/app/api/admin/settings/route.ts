import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/repos/settings";
import { requireBody, requireSession } from "@/lib/api";
import { settingsUpdateSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json(await getSettings());
}

export async function PUT(req: NextRequest) {
  const guard = await requireBody(req, settingsUpdateSchema);
  if (!guard.ok) return guard.response;

  // Only the keys that actually differ are written, each as its own row, so
  // two editors changing different fields can't clobber one another.
  const { settings, changed } = await updateSettings(guard.data);

  if (changed.length > 0) {
    await tryRecordAudit({
      actor: guard.session,
      action: "update",
      entity: "settings",
      detail: changed.join(", "),
      ip: clientIp(req),
    });
  }

  return NextResponse.json(settings);
}
