"use client"
import ReactStars from "react-rating-stars-component";

export default function RatingCard({ rating }: { rating: number }) {
	const fixed_rating = Number(rating.toFixed(2));
    return (
		<div className="h-44 flex-1">
			<div className="flex h-full flex-col justify-center overflow-hidden rounded-lg bg-[#f5f5f5] p-6">
				<div className="text-6xl font-bold">{rating}</div>
				<div className="py-1.5">
					<ReactStars
						count={5}
						size={24}
						value={fixed_rating}
						edit={false}
						isHalf={true}
						color="#e2dfdf"
					/>
				</div>
				<div className="mt-2 leading-5 text-[#03c97a]">
					All from verified purchases
				</div>
			</div>
		</div>
	);
}
