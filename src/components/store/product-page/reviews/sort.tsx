import { Dispatch, FC, SetStateAction } from 'react'
import { ReviewsOrderType } from '@/lib/types'
import styles from '../product.module.css'

interface Props {
    sort: ReviewsOrderType | undefined
    setSort: Dispatch<SetStateAction<ReviewsOrderType | undefined>>
}

const ReviewsSort: FC<Props> = ({ sort, setSort }) => (
    <label className={styles.reviewSort}>
        <span>Sort reviews</span>
        <select value={sort?.orderBy ?? 'default'} onChange={(event) => {
            const value = event.target.value
            setSort(value === 'default' ? undefined : { orderBy: value as 'latest' | 'highest' })
        }}>
            <option value="default">Featured</option>
            <option value="highest">Highest rated</option>
            <option value="latest">Latest</option>
        </select>
    </label>
)

export default ReviewsSort
