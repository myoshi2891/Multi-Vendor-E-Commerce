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
import ReactStars from 'react-rating-stars-component'
import { z } from 'zod'
import Select from '../ui/select'
import Input from '../ui/input'
import { Button } from '../ui/button'
import { PulseLoader } from 'react-spinners'
import ImageUploadStore from '../shared/upload-images'
import { upsertReview } from '@/queries/review'
import { v4 } from 'uuid'

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

    // Temporary state for images
    const [images, setImages] = useState<{ url: string }[]>([])

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
        } catch (error: any) {
            // Handle error submission errors
            console.error(error)
            toast.error('Failed to add review.')
        }
    }

    const variants = variantsInfo.map((v) => ({
        name: v.variantName,
        value: v.variantName,
        image: v.variantImage,
        colors: v.colors.map((c) => c.name).join(','),
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
            form.setValue('color', variant.colors.join(','))
        }
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
                                                    <ReactStars
                                                        count={5}
                                                        size={40}
                                                        color="#e2dfdf"
                                                        activeColor="#FFD804"
                                                        value={field.value}
                                                        onChange={
                                                            field.onChange
                                                        }
                                                        isHalf
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
                                                    className="min-h-32 w-full rounded-xl p-4 ring-1 ring-transparent duration-200 focus:outline-none focus:ring-[#11BE86]"
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
                                                        setImages(
                                                            (prevImages) => {
                                                                const updatedImages =
                                                                    [
                                                                        ...prevImages,
                                                                        { url },
                                                                    ]
                                                                if (
                                                                    updatedImages.length <=
                                                                    3
                                                                ) {
                                                                    field.onChange(
                                                                        updatedImages
                                                                    )
                                                                    return updatedImages
                                                                } else {
                                                                    return prevImages
                                                                }
                                                            }
                                                        )
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
