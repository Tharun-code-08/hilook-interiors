import { requireAdmin } from "@/lib/admin-session";
import { listProcessSteps } from "@/lib/repos/content";
import ProcessAdmin from "./ProcessAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminProcessPage() {
  // Before any query: the layout's check does not cover this page's data.
  await requireAdmin();
  const initial = await listProcessSteps();
  return <ProcessAdmin initial={initial} />;
}
