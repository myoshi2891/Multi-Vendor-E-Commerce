'use client'
import {
    RatingStatisticsType,
    ReviewsFilterType,
    ReviewsOrderType,
    ReviewWithImageType,
    VariantInfoType,
} from '@/lib/types'
import { FC, useEffect, useState } from 'react'
import RatingCard from '../../cards/product-rating'
import RatingStatisticsCard from '../../cards/rating-statistics'
import { Review } from '@prisma/client'
import ReviewCard from '../../cards/review'
import { getProductFilteredReviews } from '@/queries/product'
import ReviewFilters from './filters'
import ReviewsSort from './sort'
import Pagination from '../../shared/pagination'
import ReviewDetails from '../../forms/review-details'

interface Props {
    productId: string
    rating: number
    statistics: RatingStatisticsType
    reviews: ReviewWithImageType[]
    variantsInfo: VariantInfoType[]
}

const ProductReviews: FC<Props> = ({
    productId,
    rating,
    statistics,
    reviews,
    variantsInfo,
}) => {
    const [data, setData] = useState<ReviewWithImageType[]>(reviews)
    const { totalReviews, ratingStatistics } = statistics
    const half = Math.ceil(data.length / 2)

    // Filtering
    const filtered_data = {
        rating: undefined,
        hasImages: undefined,
    }
    const [filters, setFilters] = useState<ReviewsFilterType>(filtered_data)

    // Sorting
    const [sort, setSort] = useState<ReviewsOrderType>()

    // Pagination
    const [page, setPage] = useState<number>(1)
    const [pageSize, setPageSize] = useState<number>(4)

    useEffect(() => {
        if (filters.rating || filters.hasImages || sort) {
            setPage(1)
            handleGetReviews()
        }
        if (page) {
            handleGetReviews()
        }
    }, [filters, sort, page])

    const handleGetReviews = async () => {
        const res = await getProductFilteredReviews(
            productId,
            filters,
            sort,
            page,
            pageSize
        )
        setData(res)
    }

    return (
        <div id="reviews" className="pt-6">
            {/* Title */}
            <div className="h-12">
                <h2 className="text-2xl font-bold text-main-primary">
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
                        <ReviewFilters
                            filters={filters}
                            setFilters={setFilters}
                            setSort={setSort}
                            stats={statistics}
                        />
                        {/* Review sort */}
                        <ReviewsSort sort={sort} setSort={setSort} />
                    </div>
                    {/* Reviews */}
                    <div className="mt-6 grid grid-cols-2 gap-4">
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
                    {data.length >= pageSize && (
                        <Pagination
                            page={page}
                            setPage={setPage}
                            totalPages={
                                filters.rating || filters.hasImages
                                    ? data.length / pageSize
                                    : totalReviews / pageSize
                            }
                        />
                    )}
                </>
            )}
            <div className="mt-10">
                <ReviewDetails
                    productId={productId}
                    setReviews={setData}
                    variantsInfo={variantsInfo}
                    reviews={data}
                />
            </div>
        </div>
    )
}

export default ProductReviews
