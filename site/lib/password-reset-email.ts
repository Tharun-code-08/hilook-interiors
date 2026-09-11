import "server-only";
import type { OutgoingEmail } from "./email";

/**
 * The reset email. Plain text first — it is the part every client shows and
 * every spam filter reads — with a simple HTML version beside it.
 *
 * It names the account, says how long the link lasts, and says plainly that
 * ignoring it is safe: the password does not change unless the link is used.
 */
export function passwordResetEmail(input: {
  to: string;
  username: string;
  link: string;
  minutes: number;
}): OutgoingEmail {
  const { to, username, link, minutes } = input;

  const text = [
    `Someone asked to reset the password for the Hilook Interiors admin account "${username}".`,
    "",
    "Choose a new password here:",
    link,
    "",
    `The link works once and expires in ${minutes} minutes.`,
    "",
    "If you didn't ask for this, you can ignore this email. Your password won't change unless the link is used.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#101828;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e7ec;border-radius:8px;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 4px;font-size:13px;color:#475467;">Hilook Interiors</p>
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">Reset your password</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.55;">
                  Someone asked to reset the password for the admin account
                  <strong>${escapeHtml(username)}</strong>.
                </p>
                <p style="margin:0 0 20px;">
                  <a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 20px;border-radius:6px;">Choose a new password</a>
                </p>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#475467;">
                  The link works once and expires in ${minutes} minutes. If the button does not open,
                  paste this into your browser:<br />
                  <span style="word-break:break-all;color:#101828;">${escapeHtml(link)}</span>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.55;color:#475467;">
                  If you didn't ask for this, you can ignore this email. Your password won't change
                  unless the link is used.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { to, subject: "Reset your Hilook Interiors admin password", text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
