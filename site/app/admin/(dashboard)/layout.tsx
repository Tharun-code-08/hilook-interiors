import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { findUserById } from "@/lib/repos/operations";
import { ensureCsrfToken } from "@/lib/csrf-server";
import AdminNav from "./AdminNav";
import AdminProviders from "./components/AdminProviders";

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
      <div
        style={{
          minHeight: "100vh",
          background: "#F4F1EA",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div className="hi-admin-shell" style={{ display: "flex", minHeight: "100vh" }}>
          <AdminNav
            username={session.username}
            role={session.role}
            mustChangePassword={currentUser.mustChangePassword}
          />
          <main style={{ flex: 1, padding: "2.5rem clamp(1.25rem, 4vw, 3rem)", minWidth: 0 }}>
            {currentUser.mustChangePassword && <ForcedPasswordNotice />}
            {children}
          </main>
        </div>

        <style>{`
        @media (max-width: 720px) {
          .hi-admin-shell {
            flex-direction: column !important;
          }
        }
      `}</style>
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
    <div
      style={{
        background: "#5A2630",
        color: "#F8F2E8",
        padding: "0.9rem 1.25rem",
        fontSize: "0.82rem",
        lineHeight: 1.55,
        marginBottom: "1.75rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.6rem",
      }}
    >
      <span>
        This account is still using the password it was created with. Set your own before you go
        live.
      </span>
      <a
        href="/admin/password?forced=1"
        style={{ color: "#F8F2E8", textDecoration: "underline", flexShrink: 0, fontWeight: 600 }}
      >
        Change it now →
      </a>
    </div>
  );
}
