import { NextRequest, NextResponse } from "next/server";
import { subscribe } from "@/lib/repos/operations";
import { clientIp } from "@/lib/request";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { newsletterSchema, parseBody } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const limit = await checkRateLimit("newsletter", ip);
  if (!limit.ok) {
    return rateLimitResponse(limit, "Too many signups from this connection. Try again later.");
  }

  const parsed = await parseBody(req, newsletterSchema);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fieldErrors: parsed.fieldErrors },
      { status: 400 }
    );
  }

  const { email, website } = parsed.data;

  if (website.trim().length > 0) {
    console.warn(`[hilook] newsletter signup discarded as spam (honeypot) from ${ip}`);
    return NextResponse.json({ ok: true });
  }

  // Upsert, lower-cased. Whether an address is already on the list is not
  // something an anonymous caller should be able to probe, so the response is
  // identical either way.
  await subscribe(email);
  return NextResponse.json({ ok: true });
}
