import { listReviews } from "@/lib/repos/content";
import ReviewsAdmin from "./ReviewsAdmin";

/** Server component: the list ships in the HTML rather than being fetched after hydration. */
export default async function AdminReviewsPage() {
  const initial = await listReviews();
  return <ReviewsAdmin initial={initial} />;
}
