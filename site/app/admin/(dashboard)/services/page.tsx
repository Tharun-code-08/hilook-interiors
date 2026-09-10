import { requireAdmin } from "@/lib/admin-session";
import { listServices } from "@/lib/repos/content";
import ServicesAdmin from "./ServicesAdmin";

/**
 * Server component: the list is in the HTML, not fetched after hydration.
 *
 * Every admin list used to render an empty shell, hydrate, and only then ask
 * for its own data — a round trip the server had already made. Measured at
 * roughly 150-460ms of "Loading…" per navigation, on data the server was
 * holding when it rendered the page.
 */
export default async function AdminServicesPage() {
  // Before any query: the layout's check does not cover this page's data.
  await requireAdmin();
  const services = await listServices();
  return <ServicesAdmin initial={services} />;
}
