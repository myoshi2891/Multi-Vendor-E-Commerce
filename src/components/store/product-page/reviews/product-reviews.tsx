import { RatingStatisticsType } from "@/lib/types";
import { FC } from "react";

interface Props {
    productId: string;
    rating: number
    statistics: RatingStatisticsType
}

const ProductReviews: FC<Props> = ({ productId, rating, statistics }) => {
    const {totalReviews} = statistics
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
					{/* Rating stats card */}
				</div>
			</div>
			{totalReviews > 0 && (
				<>
                    <div className="space-y-6">
					{/* Review filters */}
                        
					{/* Review sort */}
                    </div>
                    {/* Reviews */}
                    <div className="mt-10 min-h-72 grid grid-cols-2 gap-6"></div>
                    {/* Pagination */}
				</>
			)}
		</div>
	);
}
 
export default ProductReviews;