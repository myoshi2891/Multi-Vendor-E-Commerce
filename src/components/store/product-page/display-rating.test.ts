import { resolveProductRating } from './display-rating'

describe('resolveProductRating', () => {
    const buckets = [
        { rating: 1, numReviews: 0 },
        { rating: 2, numReviews: 0 },
        { rating: 3, numReviews: 0 },
        { rating: 4, numReviews: 1 },
        { rating: 5, numReviews: 2 },
    ]

    it('uses review statistics when a stored rating is zero despite reviews', () => {
        expect(resolveProductRating(0, buckets)).toBeCloseTo(4.67, 2)
    })

    it('retains a valid stored rating and handles empty reviews', () => {
        expect(resolveProductRating(4.5, buckets)).toBe(4.5)
        expect(resolveProductRating(0, [])).toBe(0)
    })
})
