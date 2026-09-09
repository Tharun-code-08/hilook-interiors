import { countSubmissions, listSubmissions } from "@/lib/repos/operations";
import SubmissionsAdmin from "./SubmissionsAdmin";

const SHOWN = 100;

/** Server component: the enquiries ship in the HTML rather than being fetched. */
export default async function AdminSubmissionsPage() {
  // Real and flagged are fetched separately rather than filtered in the
  // browser: the two lists are capped independently, so a spam run cannot push
  // genuine enquiries out of the page.
  const [submissions, total, flagged, flaggedTotal] = await Promise.all([
    listSubmissions(SHOWN, { flagged: false }),
    countSubmissions({ flagged: false }),
    listSubmissions(SHOWN, { flagged: true }),
    countSubmissions({ flagged: true }),
  ]);

  return (
    <SubmissionsAdmin
      initial={submissions}
      total={total}
      shown={SHOWN}
      initialFlagged={flagged}
      flaggedTotal={flaggedTotal}
    />
  );
}
