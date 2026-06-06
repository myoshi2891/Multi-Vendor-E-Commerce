'use client'
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form'
import { AddReviewSchema } from '@/lib/schemas'
import {
    ReviewDetailsType,
    ReviewWithImageType,
    VariantInfoType,
} from '@/lib/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Star } from 'lucide-react'
import { z } from 'zod'
import Select from '../ui/select'
import Input from '../ui/input'
import { Button } from '../ui/button'
import { PulseLoader } from 'react-spinners'
import ImageUploadStore from '../shared/upload-images'
import { upsertReview } from '@/queries/review'
import { v4 } from 'uuid'

/**
 * Renders an interactive star rating control with half-star precision and optional editability.
 *
 * Displays `count` stars using `value` as the current rating; hovering shows a preview (half or full)
 * based on cursor position. When `edit` is true the user can:
 * - select a half or full star by clicking (cursor left/right half → `index + 0.5` or `index + 1`),
 * - preview selection on hover,
 * - adjust the rating with Arrow keys in 0.5 increments (clamped to the range `[1, count]`).
 *
 * @param value - Current rating value used for rendering (may include .5 for half stars)
 * @param onChange - Optional callback invoked with the new rating value when the user changes it
 * @param size - Pixel size for each star (width and height)
 * @param count - Number of stars to render
 * @param edit - When false, disables mouse and keyboard interactions and renders read-only stars
 */
function CustomRatingStars({
    value,
    onChange,
    size = 40,
    count = 5,
    edit = true,
}: {
    value: number
    onChange?: (value: number) => void
    size?: number
    count?: number
    edit?: boolean
}) {
    const [hoverValue, setHoverValue] = useState<number | null>(null)
    const activeValue = hoverValue !== null ? hoverValue : value

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
        if (!edit) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const width = rect.right - rect.left
        const nextValue = index + (x < width / 2 ? 0.5 : 1)
        setHoverValue(nextValue)
    }

    const handleMouseLeave = () => {
        if (!edit) return
        setHoverValue(null)
    }

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
        if (!edit || !onChange) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const width = rect.right - rect.left
        const nextValue = index + (x < width / 2 ? 0.5 : 1)
        onChange(Math.max(1, nextValue))
    }

    // キーボード操作: 矢印キーで 0.5 刻みに評価を増減する（[1, count] にクランプ）
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!edit || !onChange) return
        let nextValue: number | null = null
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            nextValue = Math.min(count, value + 0.5)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            nextValue = Math.max(1, value - 0.5)
        }
        if (nextValue === null) return
        e.preventDefault()
        onChange(nextValue)
    }

    return (
        <div
            className="flex items-center gap-x-1"
            onMouseLeave={handleMouseLeave}
        >
            {Array.from({ length: count }).map((_, index) => {
                const starValue = index + 1
                const isFull = activeValue >= starValue
                const isHalf = activeValue >= starValue - 0.5 && activeValue < starValue

                return (
                    <button
                        key={starValue}
                        type="button"
                        className={`relative rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            edit ? 'cursor-pointer' : ''
                        }`}
                        style={{ width: size, height: size }}
                        onMouseMove={(e) => handleMouseMove(e, index)}
                        onClick={(e) => handleClick(e, index)}
                        onKeyDown={edit ? handleKeyDown : undefined}
                        aria-label={edit ? `Rate ${starValue} out of ${count}` : undefined}
                        disabled={!edit}
                        data-testid={`star-wrapper-${index}`}
                    >
                        {/* Empty Star Background */}
                        <Star
                            size={size}
                            className="text-[#e2dfdf] absolute top-0 left-0"
                            fill="#e2dfdf"
                        />
                        {/* Active Star Overlay */}
                        {isFull && (
                            <Star
                                size={size}
                                className="text-[#FFD804] absolute top-0 left-0"
                                fill="#FFD804"
                            />
                        )}
                        {isHalf && (
                            <div
                                className="absolute top-0 left-0 overflow-hidden"
                                style={{ width: '50%', height: size }}
                            >
                                <Star
                                    size={size}
                                    className="text-[#FFD804]"
                                    fill="#FFD804"
                                />
                            </div>
                        )}
                    </button>
                )
            })}
        </div>
    )
}

/**
 * Render the "Add a review" form for a product and handle creating or updating reviews.
 *
 * Displays a rating control (with half-star precision), variant/size/quantity selectors, review text, and an image uploader (up to 3 images).
 * On submission, calls the backend upsertReview, updates the provided `reviews` state via `setReviews` when a review id is returned, and shows success or error toasts.
 * When the selected variant changes, updates the available sizes and the form's color value based on the variant data.
 *
 * @param productId - The product identifier for which the review is being created or updated
 * @param data - Optional existing review data to prefill the form (used for editing)
 * @param variantsInfo - Array of available product variants including sizes, colors, and images
 * @param reviews - Current list of reviews for the product; used to replace or append the returned review after upsert
 * @param setReviews - State setter to update the reviews list after a successful upsert
 * @returns A React element containing the review form UI
 */
export default function ReviewDetails({
    productId,
    data,
    variantsInfo,
    reviews,
    setReviews,
}: {
    productId: string
    data?: ReviewDetailsType
    variantsInfo: VariantInfoType[]
    reviews: ReviewWithImageType[]
    setReviews: Dispatch<SetStateAction<ReviewWithImageType[]>>
}) {
    // State for selected variant
    const [activeVariant, setActiveVariant] = useState<VariantInfoType>(
        variantsInfo[0]
    )



    // State for sizes
    const [sizes, setSizes] = useState<{ name: string; value: string }[]>([])

    // Form hook for managing form state and validation
    const form = useForm<z.infer<typeof AddReviewSchema>>({
        mode: 'onChange', // Form validation mode
        resolver: zodResolver(AddReviewSchema), // Resolver for form validation
        defaultValues: {
            variantName: data?.variant || activeVariant.variantName,
            rating: data?.rating || 0,
            size: data?.size || '',
            review: data?.review || '',
            quantity: data?.quantity || undefined,
            images: data?.images || [],
            color: data?.color || '',
        },
    })

    // Loading status based on form submission
    const isLoading = form.formState.isSubmitting

    // Errors
    const errors = form.formState.errors

    // Submit handler for form submission
    const handleSubmit = async (values: z.infer<typeof AddReviewSchema>) => {
        try {
            const response = await upsertReview(productId, {
                id: data?.id || v4(),
                variant: values.variantName,
                images: values.images,
                quantity: values.quantity,
                rating: values.rating,
                review: values.review,
                size: values.size,
                color: values.color,
            })

            if (response.id) {
                const rev = reviews.filter((rev) => rev.id !== response.id)
                setReviews([...rev, response])
            }

            toast.success('Review added successfully.')
        } catch (error: unknown) {
            // Handle error submission errors
            if (error instanceof Error) {
                console.error('Failed to add review:', error.message, error.stack)
            } else {
                console.error('Failed to add review:', error)
            }
            toast.error('Failed to add review.')
        }
    }

    const variants = variantsInfo.map((v) => ({
        name: v.variantName,
        value: v.variantName,
        image: v.variantImage,
        // colors は Partial<Color>[] のため name が undefined の要素を除外してから連結する
        colors: v.colors
            .map((c) => c?.name)
            .filter(Boolean)
            .join(','),
    }))

    useEffect(() => {
        form.setValue('size', '')
        const name = form.getValues().variantName
        const variant = variantsInfo.find((v) => v.variantName === name)
        if (variant) {
            const sizes_data = variant.sizes.map((s) => ({
                name: s.size,
                value: s.size,
            }))
            setActiveVariant(variant)
            if (sizes) setSizes(sizes_data)
            form.setValue(
                'color',
                variant.colors
                    .map((c) => c?.name)
                    .filter(Boolean)
                    .join(',')
            )
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.getValues().variantName])
    return (
        <div>
            <div className="rounded-xl bg-[#f5f5f5] p-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                        <div className="flex flex-col space-y-4">
                            {/* Title */}
                            <div className="pt-4">
                                <h1 className="text-2xl font-bold">
                                    Add a review
                                </h1>
                            </div>
                            {/* Form items */}
                            <div className="flex flex-col gap-3">
                                <FormField
                                    control={form.control}
                                    name="rating"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="flex items-center gap-x-2">
                                                     <CustomRatingStars
                                                         count={5}
                                                         size={40}
                                                         value={field.value}
                                                         onChange={
                                                             field.onChange
                                                         }
                                                         edit={true}
                                                     />
                                                    <span>
                                                        (
                                                        {form
                                                            .getValues()
                                                            .rating.toFixed(1)}
                                                        out of 5.0 )
                                                    </span>
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <div className="flex w-full flex-wrap gap-x-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <FormField
                                            control={form.control}
                                            name="variantName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Select
                                                            name={field.name}
                                                            value={field.value}
                                                            onChange={
                                                                field.onChange
                                                            }
                                                            options={variants}
                                                            placeholder="Select product"
                                                            subPlaceholder="Please select a product"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="size"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Select
                                                            name={field.name}
                                                            value={field.value}
                                                            onChange={
                                                                field.onChange
                                                            }
                                                            options={sizes}
                                                            placeholder="Select size"
                                                            subPlaceholder="Please select a size"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="quantity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            name="quantity"
                                                            type="number"
                                                            value={
                                                                field.value
                                                                    ? field.value.toString()
                                                                    : ''
                                                            }
                                                            onChange={(
                                                                value
                                                            ) => {
                                                                field.onChange(
                                                                    value.toString()
                                                                )
                                                            }}
                                                            placeholder="Select size"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="review"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <textarea
                                                    className="min-h-32 w-full rounded-xl p-4 ring-1 ring-transparent duration-200 focus:outline-none focus:ring-ring"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Write your review here..."
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />{' '}
                                <FormField
                                    control={form.control}
                                    name="images"
                                    render={({ field }) => (
                                        <FormItem className="w-full xl:border-r">
                                            <FormControl>
                                                <ImageUploadStore
                                                    value={field.value.map(
                                                        (image) => image.url
                                                    )}
                                                    // disabled={isLoading}
                                                    onChange={(url) => {
                                                        const currentImages = field.value || []
                                                        if (currentImages.length < 3) {
                                                            field.onChange([...currentImages, { url }])
                                                        }
                                                    }}
                                                    onRemove={(url) =>
                                                        field.onChange([
                                                            ...field.value.filter(
                                                                (current) =>
                                                                    current.url !==
                                                                    url
                                                            ),
                                                        ])
                                                    }
                                                    maxImages={3}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="space-y-2 text-destructive">
                                {errors.rating && (
                                    <p>{errors.rating.message}</p>
                                )}
                                {errors.size && <p>{errors.size.message}</p>}
                                {errors.review && (
                                    <p>{errors.review.message}</p>
                                )}
                            </div>
                            <div className="flex w-full justify-end">
                                <Button type="submit" className="h-12 w-36">
                                    {isLoading ? (
                                        <PulseLoader size={5} color="#fff" />
                                    ) : (
                                        'Submit Review'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    )
}
