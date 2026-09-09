import "./admin.css";

/**
 * Wraps everything under /admin — the sign-in page as well as the dashboard.
 *
 * It exists to do two things in one place: load the panel's stylesheet (which
 * Next then serves only on these routes, not on the public site), and put the
 * `.ad` class on a single root so every design token below it resolves. Both
 * used to be absent, which is why the panel was 260 inline style objects.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="ad">{children}</div>;
}
