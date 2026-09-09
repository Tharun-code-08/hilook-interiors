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
};

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, secret()) as SessionPayload;
  } catch {
    return null;
  }
}

/** Server Components / Route Handlers only (reads the httpOnly cookie). */
export async function getSessionUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
