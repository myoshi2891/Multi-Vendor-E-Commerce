"use client";
import { StatisticsCardType } from "@/lib/types";
import ReactStars from "react-rating-stars-component";

export default function RatingStatisticsCard({
	statistics,
}: {
	statistics: StatisticsCardType;
}) {
	return (
		<div className="h-44 flex-1">
			<div className="flex flex-col justify-center gap-y-2 overflow-hidden rounded-lg bg-[#f5f5f5] px-7 py-5">
				{statistics.slice().reverse().map((rating) => (
					<div
						key={rating.rating}
						className="flex items-center gap-x-2"
					>
						<ReactStars
							count={5}
							size={15}
							value={rating.rating}
							edit={false}
							isHalf={true}
							color="#e2dfdf"
						/>
						<div className="relative mx-2.5 h-1.5 w-full flex-1 rounded-full bg-[#e2dfdf]">
                            <div className="absolute left-0 h-full rounded-full bg-[#ffc50A]"
                            style={{ width: `${rating.percentage}%` }}/>
						</div>
						<div className="w-12 text-xs leading-4">
							{rating.numReviews}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
