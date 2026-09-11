import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserById, setUserEmail } from "@/lib/repos/operations";
import { clearResetTokens } from "@/lib/repos/password-resets";
import { requireBody } from "@/lib/api";
import { accountEmailSchema } from "@/lib/validation";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { tryRecordAudit } from "@/lib/audit";

/**
 * The signed-in operator's own recovery email.
 *
 * It asks for the current password, the same as changing the password does.
 * This address decides where the keys to the account get sent, so a session
 * left open on someone else's machine must not be enough to point it at a
 * new inbox and take the account with a reset.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireBody(req, accountEmailSchema);
  if (!guard.ok) return guard.response;

  const ip = clientIp(req);
  const limit = await checkRateLimit("password-change", `${ip}:${guard.session.sub}`);
  if (!limit.ok) return rateLimitResponse(limit, "Too many attempts. Try again shortly.");

  const user = await findUserById(guard.session.sub);
  if (!user) {
    return NextResponse.json({ error: "Your account no longer exists." }, { status: 401 });
  }

  if (!bcrypt.compareSync(guard.data.currentPassword, user.passwordHash)) {
    return NextResponse.json(
      { error: "Current password is incorrect", fieldErrors: { currentPassword: ["Incorrect"] } },
      { status: 400 }
    );
  }

  const email = guard.data.email.trim() || null;
  const result = await setUserEmail(user.id, email);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "That email address is already used by another account",
        fieldErrors: { email: ["Already in use"] },
      },
      { status: 409 }
    );
  }

  // A link already sent to the old address stops working with the change.
  await clearResetTokens(user.id);

  await tryRecordAudit({
    actor: guard.session,
    action: "email.change",
    entity: "user",
    entityId: user.id,
    detail: email ? "recovery email set" : "recovery email removed",
    ip,
  });

  return NextResponse.json({ ok: true, email });
}
