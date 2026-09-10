import { requireAdmin } from "@/lib/admin-session";
import { listProjects } from "@/lib/repos/content";
import PortfolioAdmin from "./PortfolioAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminPortfolioPage() {
  // Before any query: the layout's check does not cover this page's data.
  await requireAdmin();
  const initial = await listProjects();
  return <PortfolioAdmin initial={initial} />;
}
