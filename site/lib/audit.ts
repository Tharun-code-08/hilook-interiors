import "server-only";
import { recordAudit } from "./repos/operations";
import type { SessionPayload } from "./auth";

export type AuditAction =
  | "login"
  | "login.failed"
  | "logout"
  | "password.change"
  | "create"
  | "update"
  | "delete"
  | "reorder"
  | "upload"
  | "export"
  | "session.revoke";

/**
 * Audit writes must never fail the operation they describe — a database
 * hiccup should not turn a successful save into a 500. Logs and swallows.
 */
export async function tryRecordAudit(options: {
  actor: SessionPayload | { sub: string; username: string };
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  detail?: string | null;
  ip?: string | null;
}): Promise<void> {
  try {
    await recordAudit({
      actorId: options.actor.sub,
      actorName: options.actor.username,
      action: options.action,
      entity: options.entity,
      entityId: options.entityId,
      detail: options.detail,
      ip: options.ip,
    });
  } catch (error) {
    console.error("[hilook] audit write failed", error);
  }
}
