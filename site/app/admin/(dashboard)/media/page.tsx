import { listMedia } from "@/lib/repos/operations";
import MediaAdmin from "./MediaAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminMediaPage() {
  const initial = await listMedia();
  return <MediaAdmin initial={initial} />;
}
