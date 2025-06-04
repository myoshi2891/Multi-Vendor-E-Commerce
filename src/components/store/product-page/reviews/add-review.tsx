"use client"
import { ReviewWithImageType } from "@/lib/types";
import { Dispatch, SetStateAction, useState } from "react";

export default function AddReview({
	productId,
	reviews,
	// setReviews,
}: {
	productId: string;
	reviews: ReviewWithImageType[];
	// setReviews: Dispatch<SetStateAction<ReviewWithImageType[]>>
    }) {
    const [reviews_data, setReviewsData] = useState<ReviewWithImageType[]>(reviews);
	return <div>AddReview</div>;
}
