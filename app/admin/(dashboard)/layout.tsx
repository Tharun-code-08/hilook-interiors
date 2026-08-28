import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDB } from "@/lib/db";
import AdminNav from "./AdminNav";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/admin/login");
  }

  const db = await getDB();
  const usingSeedAccount = db.data.users.some(
    (u) => u.id === "user-1" && u.username === "admin"
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F4F1EA", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="hi-admin-shell" style={{ display: "flex", minHeight: "100vh" }}>
        <AdminNav username={session.username} role={session.role} />
        <main style={{ flex: 1, padding: "2.5rem clamp(1.25rem, 4vw, 3rem)", minWidth: 0 }}>
          {usingSeedAccount && (
            <div
              style={{
                background: "#5A2630",
                color: "#F8F2E8",
                padding: "0.9rem 1.25rem",
                fontSize: "0.82rem",
                marginBottom: "1.75rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.6rem",
              }}
            >
              <span>
                You&rsquo;re still using the default <strong>admin</strong> account with its seed
                password. Add your own owner account and remove this one before going live.
              </span>
              <a
                href="/admin/users"
                style={{ color: "#F8F2E8", textDecoration: "underline", flexShrink: 0 }}
              >
                Manage Admin Users →
              </a>
            </div>
          )}
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
  );
}
