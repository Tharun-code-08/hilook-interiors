import { getSettings } from "@/lib/repos/settings";
import ContentAdmin from "./ContentAdmin";

/** Server component: the settings ship in the HTML rather than being fetched. */
export default async function AdminContentPage() {
  const settings = await getSettings();
  return <ContentAdmin initial={settings} />;
}
