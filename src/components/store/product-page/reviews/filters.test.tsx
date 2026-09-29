/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import type { RatingStatisticsType } from '@/lib/types'
import ReviewFilters from './filters'

const stats = {
    totalReviews: 3,
    reviewsWithImagesCount: 1,
    ratingStatistics: [{ rating: 5, numReviews: 2 }],
} as unknown as RatingStatisticsType

describe('ReviewFilters', () => {
    it('exposes filters as keyboard-operable selected buttons', () => {
        const setFilters = jest.fn()
        const setSort = jest.fn()
        render(<ReviewFilters filters={{ rating: undefined, hasImages: undefined }} setFilters={setFilters} setSort={setSort} stats={stats} />)

        expect(screen.getByRole('button', { name: 'All (3)' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(screen.getByRole('button', { name: '5 stars (2)' }))
        expect(setFilters).toHaveBeenCalledWith({ rating: 5, hasImages: undefined })
    })
})
