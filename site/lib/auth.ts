import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AdminUser } from "./types";

export { SESSION_COOKIE } from "./session-cookie";
import { SESSION_COOKIE } from "./session-cookie";

// Set SESSION_SECRET in your environment for a multi-instance/production
// deployment. Without it, a random secret is generated on first run and
// persisted to data/.session-secret (git-ignored) so sessions survive
// restarts on this machine but aren't signed with a guessable default.
function loadOrCreateSecret(): string {
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      console.warn(
        "[hilook] SESSION_SECRET is shorter than 32 characters. Generate a strong one with:\n" +
          "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
      );
    }
    return process.env.SESSION_SECRET;
  }

  // Writing the fallback secret to disk is the last runtime filesystem write
  // in the app. In production that write either fails outright (read-only
  // serverless filesystem) or succeeds onto a container that is about to be
  // discarded, silently invalidating every session on the next request.
  //
  // Refusing is better than either: a deployment without SESSION_SECRET is
  // misconfigured, and failing at startup says so plainly instead of
  // presenting a login that mysteriously never stays signed in.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set in production. Generate one with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  const secretPath = path.join(process.cwd(), "data", ".session-secret");
  try {
    return fs.readFileSync(secretPath, "utf-8").trim();
  } catch {
    const secret = crypto.randomBytes(48).toString("hex");
    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, secret, { mode: 0o600 });
    return secret;
  }
}

/**
 * Resolved on first use, not at import.
 *
 * `next build` runs with NODE_ENV=production, so resolving this at module
 * scope made the production guard above fire during the build — on machines
 * that legitimately don't hold the deployment secret. Deferring it to the
 * first sign or verify means the build imports cleanly and a misconfigured
 * *deployment* still fails loudly on its first authenticated request.
 */
let cachedSecret: string | null = null;

function secret(): string {
  if (cachedSecret === null) cachedSecret = loadOrCreateSecret();
  return cachedSecret;
}

export type SessionPayload = {
  sub: string; // user id
  username: string;
  role: AdminUser["role"];
  /** Session record id. Present on every token minted since revocation. */
  jti?: string;
};

export function signSession(payload: SessionPayload): string {
  const { jti, ...claims } = payload;
  return jwt.sign(claims, secret(), { expiresIn: "7d", ...(jti ? { jwtid: jti } : {}) });
}

/**
 * Signature and expiry only.
 *
 * On its own this is not enough to authenticate a request — it cannot tell a
 * live session from one that was signed out or revoked, because that fact
 * lives in the database rather than in the token. Use getSessionUser.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, secret()) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * The signed-in user for this request, or null.
 *
 * Two checks, not one: the token has to verify, *and* its session record has
 * to still be live. The second is what makes signing out, revoking a device,
 * and changing a password actually take effect — without it the token stays
 * good for its full seven days no matter what happens server-side.
 *
 * Server Components and Route Handlers only (reads the httpOnly cookie).
 */
export async function getSessionUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  // Tokens minted before sessions existed carry no jti. Rejecting them signs
  // those operators out once; accepting them would leave a permanent bypass
  // of every revocation path this adds.
  if (!payload.jti) return null;

  // Imported here rather than at module scope: middleware.ts pulls the cookie
  // name out of this module's sibling, and dragging the database client into
  // that graph would break the Edge build.
  const { findLiveSession, touchSession } = await import("./repos/sessions");

  const session = await findLiveSession(payload.jti);
  if (!session || session.userId !== payload.sub) return null;

  await touchSession(session);
  return payload;
}
