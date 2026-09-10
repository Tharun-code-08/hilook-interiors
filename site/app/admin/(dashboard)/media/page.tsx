import { requireAdmin } from "@/lib/admin-session";
import { listMedia } from "@/lib/repos/operations";
import MediaAdmin from "./MediaAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminMediaPage() {
  // Before any query: the layout's check does not cover this page's data.
  await requireAdmin();
  const initial = await listMedia();
  return <MediaAdmin initial={initial} />;
}
