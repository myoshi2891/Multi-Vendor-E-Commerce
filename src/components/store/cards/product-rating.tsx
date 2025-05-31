"use client"
import ReactStars from "react-rating-stars-component";

export default function RatingCard({ rating }: { rating: number }) {
	const fixed_rating = Number(rating.toFixed(2));
    return (
		<div className="h-44 flex-1">
			<div className="p-6 bg-[#f5f5f5] flex flex-col h-full justify-center overflow-hidden rounded-lg">
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
				<div className="text-[#03c97a] leading-5 mt-2">
					All from verified purchases
				</div>
			</div>
		</div>
	);
}
