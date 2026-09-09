"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/portfolio", label: "Portfolio" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/process", label: "Process" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/submissions", label: "Inbox" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/awards", label: "Awards & Press" },
  { href: "/admin/media", label: "Media Library" },
  { href: "/admin/users", label: "Admin Users" },
];

export default function AdminNav({ username, role }: { username: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav
      className="hi-admin-nav"
      style={{
        width: 220,
        flexShrink: 0,
        background: "#26231F",
        color: "#F4F1EA",
        padding: "2rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <p style={{ fontFamily: "Georgia, serif", fontSize: "1.15rem", marginBottom: "0.25rem" }}>
        Hilook Interiors
      </p>
      <p style={{ fontSize: "0.7rem", color: "rgba(244,241,234,0.5)", marginBottom: "2rem" }}>
        Admin panel
      </p>

      <ul className="hi-admin-nav-links" style={{ listStyle: "none", display: "grid", gap: "0.35rem", flex: 1 }}>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                style={{
                  display: "block",
                  padding: "0.55rem 0.7rem",
                  fontSize: "0.85rem",
                  borderRadius: 3,
                  whiteSpace: "nowrap",
                  color: active ? "#26231F" : "rgba(244,241,234,0.8)",
                  background: active ? "#C5A45E" : "transparent",
                }}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div style={{ borderTop: "1px solid rgba(244,241,234,0.14)", paddingTop: "1rem", marginTop: "1rem" }}>
        <p style={{ fontSize: "0.75rem", color: "rgba(244,241,234,0.65)" }}>{username}</p>
        <p style={{ fontSize: "0.7rem", color: "rgba(244,241,234,0.4)", marginBottom: "0.9rem" }}>{role}</p>
        <button
          onClick={logout}
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid rgba(244,241,234,0.24)",
            color: "#F4F1EA",
            padding: "0.5rem",
            fontSize: "0.75rem",
          }}
        >
          Log out
        </button>
        <Link
          href="/"
          style={{ display: "block", marginTop: "0.75rem", fontSize: "0.75rem", color: "rgba(244,241,234,0.5)" }}
        >
          ← View site
        </Link>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .hi-admin-nav {
            width: 100% !important;
            height: auto !important;
            max-height: 100vh;
            flex-direction: row !important;
            align-items: center !important;
            flex-wrap: wrap;
            padding: 1rem 1.25rem !important;
            gap: 1rem;
          }
          .hi-admin-nav-links {
            display: flex !important;
            flex: none !important;
            width: 100%;
            overflow-x: auto;
            order: 3;
            gap: 0.5rem !important;
          }
        }
      `}</style>
    </nav>
  );
}
