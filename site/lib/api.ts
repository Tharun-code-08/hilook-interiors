import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser, type SessionPayload } from "./auth";
import { parseBody, type ParseFailure } from "./validation";
import type { z } from "zod";

/**
 * Shared guards for the admin API.
 *
 * Every one of the 19 admin handlers opened with the same four lines of
 * session check and the same bespoke body validation. Factoring it means a
 * new route cannot accidentally ship without an auth check, and the error
 * shape is identical everywhere — which is what lets P6's admin client
 * surface failures uniformly instead of swallowing them.
 */

export type Guarded<T> = { ok: true; session: SessionPayload; data: T };
export type Denied = { ok: false; response: NextResponse };

function unauthorized(): Denied {
  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

function forbidden(message: string): Denied {
  return { ok: false, response: NextResponse.json({ error: message }, { status: 403 }) };
}

function badRequest(failure: ParseFailure): Denied {
  return {
    ok: false,
    response: NextResponse.json(
      { error: failure.error, fieldErrors: failure.fieldErrors },
      { status: failure.status }
    ),
  };
}

/**
 * Requires a valid session. Middleware already rejects requests with no
 * session cookie at the edge, but it cannot verify the signature — this is
 * where the token is actually checked.
 */
export async function requireSession(options?: {
  role?: SessionPayload["role"];
  forbiddenMessage?: string;
}): Promise<Guarded<undefined> | Denied> {
  const session = await getSessionUser();
  if (!session) return unauthorized();

  if (options?.role && session.role !== options.role) {
    return forbidden(options.forbiddenMessage ?? `Only ${options.role}s can do that`);
  }

  return { ok: true, session, data: undefined };
}

/** Requires a valid session and a body matching `schema`. */
export async function requireBody<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
  options?: { role?: SessionPayload["role"]; forbiddenMessage?: string }
): Promise<Guarded<z.infer<S>> | Denied> {
  const guard = await requireSession(options);
  if (!guard.ok) return guard;

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return badRequest(parsed);

  return { ok: true, session: guard.session, data: parsed.data };
}

export function notFound(what = "Not found") {
  return NextResponse.json({ error: what }, { status: 404 });
}

/**
 * Applies only the keys present in a validated partial patch.
 *
 * The hand-written updates used `if (typeof body.x === "string")` per field,
 * which meant an explicit `null` was indistinguishable from an omitted key.
 * Zod has already narrowed the types by this point, so presence is the only
 * question left.
 */
export function applyPatch<T extends object>(target: T, patch: Partial<T>): T {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (target as Record<string, unknown>)[key] = value;
    }
  }
  return target;
}
