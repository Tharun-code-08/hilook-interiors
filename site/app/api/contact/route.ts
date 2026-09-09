import { NextRequest, NextResponse } from "next/server";
import { createSubmission } from "@/lib/repos/operations";
import { clientIp } from "@/lib/request";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { contactSchema, parseBody } from "@/lib/validation";

/** Submissions arriving faster than this after the form rendered are scripted. */
const MIN_FILL_MS = 3000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const limit = await checkRateLimit("contact", ip);
  if (!limit.ok) {
    return rateLimitResponse(
      limit,
      "Too many enquiries sent from this connection. Please try again later, or email us directly."
    );
  }

  const parsed = await parseBody(req, contactSchema);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fieldErrors: parsed.fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, phone, message, website, startedAt } = parsed.data;

  // Spam signals. Both return the normal success shape: telling a bot which
  // check it tripped teaches the author how to evade it, and a false positive
  // on a real visitor should not look like a broken form.
  const trippedHoneypot = website.trim().length > 0;
  const submittedTooFast = startedAt !== undefined && Date.now() - startedAt < MIN_FILL_MS;

  if (trippedHoneypot || submittedTooFast) {
    console.warn(
      `[hilook] contact submission discarded as spam (${trippedHoneypot ? "honeypot" : "timing"}) from ${ip}`
    );
    return NextResponse.json({ ok: true });
  }

  await createSubmission({ name, email, phone, message });
  return NextResponse.json({ ok: true });
}
