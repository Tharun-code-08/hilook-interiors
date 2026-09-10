import { requireAdmin } from "@/lib/admin-session";
import { listReviews } from "@/lib/repos/content";
import ReviewsAdmin from "./ReviewsAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminReviewsPage() {
  // Before any query: the layout's check does not cover this page's data.
  await requireAdmin();
  const initial = await listReviews();
  return <ReviewsAdmin initial={initial} />;
}
