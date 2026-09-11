import { after, NextRequest, NextResponse } from "next/server";
import { findUserByIdentifier } from "@/lib/repos/operations";
import { issueResetToken, RESET_TOKEN_TTL_MS } from "@/lib/repos/password-resets";
import { recordError } from "@/lib/repos/errors";
import { emailConfigured, sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/password-reset-email";
import { absoluteUrl } from "@/lib/site-url";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { parseBody, passwordResetRequestSchema } from "@/lib/validation";
import { tryRecordAudit } from "@/lib/audit";

/**
 * "Forgot password?" — sends a one-time link to the account's email address.
 *
 * The reply is identical whether or not anything matched. Telling a stranger
 * "no such account" turns this into a way to list the usernames that exist.
 *
 * The same goes for time: issuing the token and sending the email happen after
 * the response, so an address that matches does not answer measurably slower
 * than one that doesn't. The work before the response is one lookup either way.
 */

const SENT = {
  ok: true,
  message: "If that matches an account with an email address, a reset link is on its way.",
};

export async function POST(req: NextRequest) {
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Password reset by email isn't set up on this site." },
      { status: 503 }
    );
  }

  const ip = clientIp(req);

  const parsed = await parseBody(req, passwordResetRequestSchema);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fieldErrors: parsed.fieldErrors },
      { status: 400 }
    );
  }
  const identifier = parsed.data.identifier.toLowerCase();

  // Per address, so one visitor cannot flood an inbox; per account name, so a
  // spread of addresses cannot either.
  const [ipLimit, accountLimit] = await Promise.all([
    checkRateLimit("password-reset", ip),
    checkRateLimit("password-reset-account", identifier),
  ]);
  if (!ipLimit.ok || !accountLimit.ok) {
    return rateLimitResponse(
      !ipLimit.ok ? ipLimit : accountLimit,
      "Too many reset requests. Try again later."
    );
  }

  const user = await findUserByIdentifier(identifier);

  if (user?.email) {
    const { id: userId, username, email } = user;

    after(async () => {
      try {
        const { token } = await issueResetToken(userId, ip);
        await sendEmail(
          passwordResetEmail({
            to: email,
            username,
            link: absoluteUrl(`/admin/reset-password?token=${encodeURIComponent(token)}`),
            minutes: RESET_TOKEN_TTL_MS / 60_000,
          })
        );
        await tryRecordAudit({
          actor: { sub: userId, username },
          action: "password.reset.request",
          entity: "user",
          entityId: userId,
          ip,
        });
      } catch (error) {
        // The visitor has already been told a link is on its way, which is
        // the only safe thing to have told them. The Errors page is where the
        // failure shows — a wrong SMTP password, most likely.
        await recordError({ error, path: "/api/admin/password-reset/request", method: "POST" });
      }
    });
  }

  return NextResponse.json(SENT);
}
