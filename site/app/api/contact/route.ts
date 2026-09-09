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

  // Spam signals. Both paths return the normal success shape: telling a bot
  // which check it tripped teaches the author how to evade it, and a false
  // positive on a real visitor should not look like a broken form.
  const trippedHoneypot = website.trim().length > 0;
  const submittedTooFast = startedAt !== undefined && Date.now() - startedAt < MIN_FILL_MS;
  const flagged = trippedHoneypot || submittedTooFast;

  // Flagged submissions are stored, not dropped.
  //
  // They used to be discarded here with nothing kept but a console warning, so
  // a false positive lost a client enquiry and left no way to notice. These
  // checks are heuristics: the honeypot can be filled by an over-eager
  // password manager, and the timing window is a guess about how fast a human
  // moves. Getting one wrong costs a commission; keeping some spam costs a
  // row. The inbox holds these separately for review, and they are excluded
  // from every count the dashboard reports.
  await createSubmission({
    name,
    email,
    phone,
    message,
    flagged,
    flagReason: flagged ? (trippedHoneypot ? "honeypot" : "timing") : null,
  });

  return NextResponse.json({ ok: true });
}
