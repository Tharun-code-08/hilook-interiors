import { countSubmissions, listSubmissions } from "@/lib/repos/operations";
import SubmissionsAdmin from "./SubmissionsAdmin";

const SHOWN = 100;

/** Server component: the enquiries ship in the HTML rather than being fetched. */
export default async function AdminSubmissionsPage() {
  const [submissions, total] = await Promise.all([listSubmissions(SHOWN), countSubmissions()]);
  return <SubmissionsAdmin initial={submissions} total={total} shown={SHOWN} />;
}
