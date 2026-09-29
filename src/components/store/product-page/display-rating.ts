export function resolveProductRating(
    storedRating: number,
    buckets: ReadonlyArray<{ rating: number; numReviews: number }>
): number {
    if (Number.isFinite(storedRating) && storedRating > 0 && storedRating <= 5) return storedRating
    const total = buckets.reduce((sum, bucket) => sum + bucket.numReviews, 0)
    if (total === 0) return 0
    return buckets.reduce((sum, bucket) => sum + bucket.rating * bucket.numReviews, 0) / total
}
