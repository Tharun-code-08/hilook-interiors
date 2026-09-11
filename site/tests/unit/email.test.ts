import { afterEach, beforeEach, describe, expect, it } from "vitest";

const KEYS = ["EMAIL_TRANSPORT", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "VERCEL"];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/**
 * "Forgot password?" is shown only when this says a message can leave. A
 * half-configured mailer that reported itself ready would send operators to
 * wait for an email that never comes.
 */
describe("email configuration", () => {
  it("is off until host, user and password are all set", async () => {
    const { emailConfigured } = await import("@/lib/email");

    expect(emailConfigured()).toBe(false);
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "support@claxonai.in";
    expect(emailConfigured()).toBe(false);
    process.env.SMTP_PASSWORD = "app-password";
    expect(emailConfigured()).toBe(true);
  });

  it("refuses to write mail to disk on Vercel", async () => {
    const { emailConfigured } = await import("@/lib/email");

    process.env.EMAIL_TRANSPORT = "file";
    process.env.EMAIL_FROM = "Hilook Interiors <support@claxonai.in>";
    expect(emailConfigured()).toBe(true);
    process.env.VERCEL = "1";
    expect(emailConfigured()).toBe(false);
  });
});
