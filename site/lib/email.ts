import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import nodemailer from "nodemailer";

/**
 * Outgoing email.
 *
 * SMTP, because the messages have to come from the studio's own mailbox
 * (support@claxonai.in), and SMTP is the one interface every host of an
 * existing mailbox offers — Google Workspace, Zoho, Microsoft 365, or a
 * transactional service such as Resend or Postmark in front of the same
 * domain. Nothing here assumes which.
 *
 * Configured entirely from the environment:
 *   SMTP_HOST, SMTP_PORT (465 = TLS from the start, 587 = STARTTLS),
 *   SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM for the visible sender.
 *
 * EMAIL_TRANSPORT=file writes each message into data/outbox/ instead of
 * sending it, which is how the e2e suite reads the link a real inbox would
 * receive. It is refused on Vercel, where a message written to disk is a
 * message nobody receives.
 */

export type OutgoingEmail = { to: string; subject: string; text: string; html: string };

function transport(): "smtp" | "file" | null {
  if (process.env.EMAIL_TRANSPORT === "file") return process.env.VERCEL ? null : "file";
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  return SMTP_HOST && SMTP_USER && SMTP_PASSWORD ? "smtp" : null;
}

function sender(): string | null {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || null;
}

/**
 * Whether a message can actually be delivered. The sign-in page only offers
 * "Forgot password?" when this is true, so nobody is sent to wait for an
 * email that was never going to leave.
 */
export function emailConfigured(): boolean {
  return transport() !== null && sender() !== null;
}

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const kind = transport();
  const from = sender();
  if (!kind || !from) {
    throw new Error(
      "Email is not configured: set SMTP_HOST, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM"
    );
  }

  if (kind === "file") {
    const dir = path.join(process.cwd(), "data", "outbox");
    await mkdir(dir, { recursive: true });
    // The timestamp leads the name so a reader can take "everything since".
    const name = `${Date.now()}-${randomBytes(4).toString("hex")}.json`;
    await writeFile(path.join(dir, name), JSON.stringify({ from, ...message }, null, 2));
    return;
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    // A mail server that stops answering should fail the send, not hold a
    // serverless function open until the platform kills it.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  await smtp.sendMail({ from, ...message });
}
