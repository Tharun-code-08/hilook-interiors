import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AdminUser } from "./db";

export const SESSION_COOKIE = "hilook_session";

// Set SESSION_SECRET in your environment for a multi-instance/production
// deployment. Without it, a random secret is generated on first run and
// persisted to data/.session-secret (git-ignored) so sessions survive
// restarts on this machine but aren't signed with a guessable default.
function loadOrCreateSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

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

const SECRET = loadOrCreateSecret();

export type SessionPayload = {
  sub: string; // user id
  username: string;
  role: AdminUser["role"];
};

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SECRET) as SessionPayload;
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
