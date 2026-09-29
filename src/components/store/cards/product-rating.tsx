"use client"
import ReactStars from "react-rating-stars-component";
import styles from '../product-page/product.module.css'

export default function RatingCard({ rating, editorial = false }: Readonly<{ rating: number; editorial?: boolean }>) {
	const fixed_rating = Number(rating.toFixed(2));
    return (
		<div className={editorial ? styles.ratingCard : "h-44 flex-1"}>
			<div className={editorial ? styles.ratingCardInner : "flex h-full flex-col justify-center overflow-hidden rounded-lg bg-[#f5f5f5] p-6"}>
				<div className={editorial ? styles.ratingNumber : "text-6xl font-bold"}>{rating.toFixed(2)}</div>
				<div className="py-1.5">
					<ReactStars
						count={5}
						size={24}
						value={fixed_rating}
						edit={false}
						isHalf={true}
						color="#e2dfdf"
						activeColor={editorial ? '#c7a464' : '#ffd804'}
					/>
				</div>
				<div className={editorial ? styles.verifiedText : "mt-2 leading-5 text-[#03c97a]"}>
					All from verified purchases
				</div>
			</div>
		</div>
	);
}
