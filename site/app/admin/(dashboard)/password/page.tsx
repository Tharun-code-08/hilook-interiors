import { requireAdmin } from "@/lib/admin-session";
import { emailConfigured } from "@/lib/email";
import SecurityAdmin from "./SecurityAdmin";

/**
 * Account security: password, recovery email, signed-in devices.
 *
 * A server page around the client form, so it can hand over the account's
 * current recovery email, and so it checks the session itself like every other
 * admin page (lib/admin-session.ts).
 */
export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireAdmin();
  const forced = (await searchParams).forced === "1";

  return <SecurityAdmin forced={forced} email={user.email} emailReady={emailConfigured()} />;
}
