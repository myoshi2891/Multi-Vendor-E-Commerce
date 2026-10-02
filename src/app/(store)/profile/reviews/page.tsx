import ReviewsContainer from "@/components/store/profile/reviews/reviews-container";
import { getUserReviewsForDisplay } from "@/queries/profile";
export const dynamic = "force-dynamic";
export default async function ProfileReviewsPage() {
    let result: Awaited<ReturnType<typeof getUserReviewsForDisplay>> = {
        reviews: [],
        totalPages: 0,
    };
    let initialError = false;
    try {
        result = await getUserReviewsForDisplay();
    } catch {
        initialError = true;
    }
    return (
        <ReviewsContainer
            {...result}
            initialError={initialError}
            fetchReviewsAction={getUserReviewsForDisplay}
        />
    );
}
