import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { findUserById } from "@/lib/repos/operations";
import { ensureCsrfToken } from "@/lib/csrf-server";
import AdminNav from "./AdminNav";
import AdminProviders from "./components/AdminProviders";
import { Banner } from "../components/ui";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/admin/login");
  }

  // Guarantees the CSRF cookie exists before any client code needs to echo it.
  // Middleware verifies the pairing on every admin mutation.
  await ensureCsrfToken();

  const currentUser = await findUserById(session.sub);

  // The session outlived the account it points at — treat as signed out.
  if (!currentUser) {
    redirect("/admin/login");
  }

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
