"use client";
import { StatisticsCardType } from "@/lib/types";
import ReactStars from "react-rating-stars-component";
import styles from '../product-page/product.module.css'

export default function RatingStatisticsCard({
	statistics, editorial = false,
}: {
	statistics: StatisticsCardType;
	editorial?: boolean;
}) {
	return (
		<div className={editorial ? styles.ratingCard : "h-44 flex-1"}>
			<div className={editorial ? styles.ratingStatsInner : "flex flex-col justify-center gap-y-2 overflow-hidden rounded-lg bg-[#f5f5f5] px-7 py-5"}>
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
							activeColor={editorial ? '#c7a464' : '#ffd804'}
						/>
						<div className="relative mx-2.5 h-1.5 flex-1 rounded-full bg-[#e2dfdf]">
                            <div className={editorial ? styles.ratingBarFill : "absolute left-0 h-full rounded-full bg-[#ffc50A]"}
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
