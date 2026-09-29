import { Dispatch, FC, SetStateAction } from 'react'
import { RatingStatisticsType, ReviewsFilterType, ReviewsOrderType } from '@/lib/types'
import styles from '../product.module.css'

interface Props {
    filters: ReviewsFilterType
    setFilters: Dispatch<SetStateAction<ReviewsFilterType>>
    stats: RatingStatisticsType
    setSort: Dispatch<SetStateAction<ReviewsOrderType | undefined>>
}

const ReviewFilters: FC<Props> = ({ filters, setFilters, stats, setSort }) => {
    const { rating, hasImages } = filters
    const { ratingStatistics, reviewsWithImagesCount, totalReviews } = stats
    return (
        <div className={styles.reviewFilters} aria-label="Filter reviews">
            <button type="button" aria-pressed={!rating && !hasImages} onClick={() => { setFilters({ rating: undefined, hasImages: undefined }); setSort(undefined) }}>All ({totalReviews})</button>
            <button type="button" aria-pressed={Boolean(hasImages)} onClick={() => setFilters({ ...filters, hasImages: !hasImages })}>With photos ({reviewsWithImagesCount})</button>
            {ratingStatistics.map((entry) => (
                <button type="button" key={entry.rating} aria-pressed={entry.rating === rating} onClick={() => setFilters({ ...filters, rating: entry.rating === rating ? undefined : entry.rating })}>
                    {entry.rating} stars ({entry.numReviews})
                </button>
            ))}
        </div>
    )
}

export default ReviewFilters
