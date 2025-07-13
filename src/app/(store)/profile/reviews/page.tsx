import ReviewsContainer from "@/components/store/profile/reviews/reviews-container";
import { getUserReviews } from "@/queries/profile";

export default async function ProfileReviewsPage() {
    const reviews_data = await getUserReviews();
    const { reviews, totalPages } = reviews_data;
    return (
        <div className="bg-white px-6 py-4">
            <h1 className="mb-3 text-lg font-bold">Your reviews</h1>
            <ReviewsContainer reviews={reviews} totalPages={totalPages} />
        </div>
    );
}
