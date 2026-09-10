import { requireAdmin } from "@/lib/admin-session";
import { ensureCsrfToken } from "@/lib/csrf-server";
import AdminNav from "./AdminNav";
import AdminProviders from "./components/AdminProviders";
import { Banner } from "../components/ui";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  // Not the only check. Every page under this layout makes it too, because a
  // layout is not re-rendered on client-side navigation — see
  // lib/admin-session.ts. Shared through cache(), so it is still one lookup.
  const { session, user: currentUser } = await requireAdmin();

  // Guarantees the CSRF cookie exists before any client code needs to echo it.
  // Middleware verifies the pairing on every admin mutation.
  await ensureCsrfToken();

  return (
    <AdminProviders>
      <div className="ad-shell">
        <AdminNav
          username={session.username}
          role={session.role}
          mustChangePassword={currentUser.mustChangePassword}
        />
        <div className="ad-main">
          <div className="ad-content">
            {currentUser.mustChangePassword && <ForcedPasswordNotice />}
            {children}
          </div>
        </div>
      </div>
    </AdminProviders>
  );
}

/**
 * Replaces the old "you're still using the default admin account" banner.
 *
 * That one was advisory and easy to scroll past, and the account it warned
 * about used a password published in the README. The account is now flagged
 * in the store, and this points at a real change-password screen.
 */
function ForcedPasswordNotice() {
  return (
    <Banner tone="warn">
      <span>
        This account is still using the password it was created with. Set your own before you go
        live.
      </span>
      <a href="/admin/password?forced=1">Change it now →</a>
    </Banner>
  );
}
