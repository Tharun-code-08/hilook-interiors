import { NextRequest, NextResponse } from "next/server";
import { recordSectionView } from "@/lib/repos/analytics";
import { clientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseBody, sectionViewSchema } from "@/lib/validation";

/**
 * Section-view beacon. Unauthenticated by necessity — it fires for anonymous
 * visitors — but the section name is checked against a fixed allowlist so the
 * key space stays finite, and calls are rate limited per IP.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const limit = await checkRateLimit("analytics", ip);
  if (!limit.ok) {
    // Beacons are fire-and-forget; the client neither reads nor retries this.
    return new NextResponse(null, { status: 204 });
  }

  const parsed = await parseBody(req, sectionViewSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await recordSectionView({
    section: parsed.data.section,
    ip,
    userAgent: req.headers.get("user-agent") ?? "",
  });
  return NextResponse.json({ ok: true });
}
