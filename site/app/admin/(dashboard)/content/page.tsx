import { requireAdmin } from "@/lib/admin-session";
import { getSettings } from "@/lib/repos/settings";
import ContentAdmin from "./ContentAdmin";

/** Server component: the settings ship in the HTML rather than being fetched. */
export default async function AdminContentPage() {
  // Before any query: the layout's check does not cover this page's data.
  await requireAdmin();
  const settings = await getSettings();
  return <ContentAdmin initial={settings} />;
}
