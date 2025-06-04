'use client'
import { ReviewWithImageType, VariantInfoType } from '@/lib/types'
import { Dispatch, SetStateAction, useState } from 'react'
import ReviewDetails from '../../forms/review-details'

export default function AddReview({
    productId,
    reviews,
    variantsInfo,
}: {
    productId: string
    reviews: ReviewWithImageType[]
    variantsInfo: VariantInfoType[]
}) {
    const [reviews_data, setReviewsData] =
        useState<ReviewWithImageType[]>(reviews)
    return (
        <div>
            <ReviewDetails
                productId={productId}
                variantsInfo={variantsInfo}
                setReviews={setReviewsData}
            />
        </div>
    )
}
