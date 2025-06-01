"use client";
import { RatingStatisticsType, ReviewWithImageType } from "@/lib/types";
import { FC, useState } from "react";
import RatingCard from "../../cards/product-rating";
import RatingStatisticsCard from "../../cards/rating-statistics";
import { Review } from "@prisma/client";
import ReviewCard from "../../cards/review";

interface Props {
	productId: string;
	rating: number;
	statistics: RatingStatisticsType;
	reviews: ReviewWithImageType[];
}

const ProductReviews: FC<Props> = ({
	productId,
	rating,
	statistics,
	reviews,
}) => {
	const [data, setData] = useState<ReviewWithImageType[]>(reviews);
	const { totalReviews, ratingStatistics } = statistics;
	const half = Math.ceil(data.length / 2);

	return (
		<div id="reviews" className="pt-6">
			{/* Title */}
			<div className="h-12">
				<h2 className="text-main-primary text-2xl font-bold">
					Custom Reviews ({totalReviews})
				</h2>
			</div>
			{/* Statistics */}
			<div className="w-full">
				<div className="flex items-center gap-4">
					{/* Rating card */}
					<RatingCard rating={rating} />
					{/* Rating stats card */}
					<RatingStatisticsCard statistics={ratingStatistics} />
				</div>
			</div>
			{totalReviews > 0 && (
				<>
					<div className="space-y-6">
						{/* Review filters */}

						{/* Review sort */}
					</div>
					{/* Reviews */}
					<div className="mt-10 min-h-72 grid grid-cols-2 gap-4">
						{data.length > 0 ? (
							<>
								<div className="flex flex-col gap-3">
									{data
										// .filter((_, index) => index % 2 === 0)
										.slice(0, half)
										.map((review) => (
											<ReviewCard
												key={review.id}
												review={review}
											/>
										))}
								</div>
								<div className="flex flex-col gap-3">
									{data
										// .filter((_, index) => index % 2 !== 0)
										.slice(half)
										.map((review) => (
											<ReviewCard
												key={review.id}
												review={review}
											/>
										))}
								</div>
							</>
						) : (
							<>No Reviews...</>
						)}
					</div>
					{/* Pagination */}
				</>
			)}
		</div>
	);
};

export default ProductReviews;
