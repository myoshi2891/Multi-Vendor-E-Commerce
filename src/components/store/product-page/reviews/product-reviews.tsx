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
import styles from '../product.module.css'

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
        let cancelled = false

        const handleGetReviews = async (fetchPage: number) => {
            try {
                const res = await getProductFilteredReviews(
                    productId,
                    filters,
                    sort,
                    fetchPage,
                    pageSize
                )
                if (!cancelled) setData(res)
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error("[ProductReviews:handleGetReviews] Error:", error.message, error.stack)
                } else {
                    console.error("[ProductReviews:handleGetReviews] Error:", error)
                }
                if (!cancelled) setData([])
            }
        }

        const isFiltered = !!(filters.rating || filters.hasImages || sort)
        const fetchPage = isFiltered ? 1 : page
        if (isFiltered) setPage(1)
        handleGetReviews(fetchPage)

        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, sort, page])

    // 端数ページも 1 ページとして数える（10 件 / 4 件 → 3 ページ）。
    // 未絞り込み時は総件数で判定し、件数の少ない最終ページでもナビゲーションを残す
    const isFilteredView = !!(filters.rating || filters.hasImages)
    const totalPages = Math.ceil(
        (isFilteredView ? data.length : totalReviews) / pageSize
    )
    const showPagination = isFilteredView
        ? data.length >= pageSize
        : totalPages > 1

    return (
        <section id="reviews" className={styles.reviewSection}>
            <div className={styles.contentHeading}><div><p>VOICES FROM THE COLLECTION</p><h2>Customer reviews ({totalReviews})</h2></div></div>
            <div>
                <div className={styles.reviewStats}>
                    {/* Rating card */}
                    <RatingCard rating={rating} editorial />
                    {/* Rating stats card */}
                    <RatingStatisticsCard statistics={ratingStatistics} editorial />
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
                    <div className={styles.reviewGrid}>
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
                                                editorial
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
                                                editorial
                                            />
                                        ))}
                                </div>
                            </>
                        ) : (
                            <>No Reviews...</>
                        )}
                    </div>
                    {/* Pagination */}
                    {showPagination && (
                        <Pagination
                            variant="editorial"
                            page={page}
                            setPage={setPage}
                            totalPages={totalPages}
                        />
                    )}
                </>
            )}
            <div className={styles.reviewFormWrap}>
                <ReviewDetails
                    productId={productId}
                    setReviews={setData}
                    variantsInfo={variantsInfo}
                    reviews={data}
                />
            </div>
        </section>
    )
}

export default ProductReviews
