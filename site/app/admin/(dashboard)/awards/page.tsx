import { listAwards } from "@/lib/repos/content";
import AwardsAdmin from "./AwardsAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminAwardsPage() {
  const initial = await listAwards();
  return <AwardsAdmin initial={initial} />;
}
