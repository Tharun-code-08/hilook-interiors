import { requireAdmin } from "@/lib/admin-session";
import { listAwards } from "@/lib/repos/content";
import AwardsAdmin from "./AwardsAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminAwardsPage() {
  // Before any query: the layout's check does not cover this page's data.
  await requireAdmin();
  const initial = await listAwards();
  return <AwardsAdmin initial={initial} />;
}
