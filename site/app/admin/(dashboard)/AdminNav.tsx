"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-client";
import { Button } from "../components/ui";

/**
 * Grouped rather than one flat list of eleven.
 *
 * The old nav mixed "edit the reviews on the home page" with "add an admin
 * account" in a single run, so finding anything meant reading all of it. These
 * are the three things an owner actually comes here to do: change what the
 * site says, deal with what has come in, or administer the panel itself.
 */
const SECTIONS = [
  {
    label: "Site content",
    links: [
      { href: "/admin/portfolio", label: "Portfolio" },
      { href: "/admin/services", label: "Services" },
      { href: "/admin/process", label: "Process" },
      { href: "/admin/reviews", label: "Reviews" },
      { href: "/admin/awards", label: "Awards & press" },
      { href: "/admin/content", label: "Text & contact" },
      { href: "/admin/media", label: "Media library" },
    ],
  },
  {
    label: "Operations",
    links: [{ href: "/admin/submissions", label: "Inbox" }],
  },
  {
    label: "Account",
    links: [
      { href: "/admin/users", label: "Admin users" },
      { href: "/admin/password", label: "Security" },
    ],
  },
] as const;

export default function AdminNav({
  username,
  role,
  mustChangePassword,
}: {
  username: string;
  role: string;
  mustChangePassword?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await adminFetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="ad-sidebar" aria-label="Admin sections">
      <div className="ad-brand">
        <div className="ad-brand-name">Hilook Interiors</div>
        <div className="ad-brand-sub">Admin</div>
      </div>

      <ul className="ad-nav">
        <li>
          <Link
            href="/admin"
            className={`ad-nav-link${pathname === "/admin" ? " is-active" : ""}`}
            aria-current={pathname === "/admin" ? "page" : undefined}
          >
            Dashboard
          </Link>
        </li>

        {/* Flat list with heading rows rather than nested <ul>s: on narrow
            screens .ad-nav becomes a horizontal scroller, and a nested list
            would not flow into it. */}
        {SECTIONS.flatMap((section) => [
          <li key={section.label} className="ad-nav-section" aria-hidden="true">
            {section.label}
          </li>,
          ...section.links.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`ad-nav-link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                  {/* Marks the one item the operator has to act on before the
                      panel is safe to use. */}
                  {link.href === "/admin/password" && mustChangePassword && (
                    <span
                      className="ad-nav-dot"
                      title="You're still using the password this account was created with"
                    >
                      <span className="ad-sr">Action required</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          }),
        ])}
      </ul>

      <div className="ad-sidebar-foot">
        <div>
          <div className="ad-who-name">{username}</div>
          <div className="ad-who-role">{role}</div>
        </div>
        <Button variant="secondary" size="sm" block onClick={logout}>
          Log out
        </Button>
        <Link href="/" className="ad-nav-link">
          ← View site
        </Link>
      </div>
    </nav>
  );
}
