import { listProjects } from "@/lib/repos/content";
import PortfolioAdmin from "./PortfolioAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminPortfolioPage() {
  const initial = await listProjects();
  return <PortfolioAdmin initial={initial} />;
}
