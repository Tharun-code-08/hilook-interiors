import { listProcessSteps } from "@/lib/repos/content";
import ProcessAdmin from "./ProcessAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminProcessPage() {
  const initial = await listProcessSteps();
  return <ProcessAdmin initial={initial} />;
}
