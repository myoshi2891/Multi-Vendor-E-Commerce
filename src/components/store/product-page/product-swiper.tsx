'use client'
// React, Next.js
import Image from 'next/image'
import { Dispatch, SetStateAction, useState } from 'react'

// Utils
import { cn } from '@/lib/utils'

//Types
import { ProductVariantImage } from '@prisma/client'

// Image Zoom
import ImageZoom from 'react-image-zooom'

/**
 * Renders a product image gallery with selectable thumbnails and a zoomable main image.
 *
 * The component displays a list of thumbnails and a main image viewer. Hovering a thumbnail sets it as the active image. If `images` is falsy, the component renders nothing.
 *
 * @param images - Array of product variant images to show as thumbnails and available to view
 * @param activeImage - Currently selected image shown in the main viewer (may be `null`)
 * @param setActiveImage - State setter to update the currently active image
 * @returns The rendered product image swiper element or nothing when `images` is falsy
 */
export default function ProductSwiper({
    images,
    activeImage,
    setActiveImage,
}: {
    images: ProductVariantImage[]
    activeImage: ProductVariantImage | null
    setActiveImage: Dispatch<SetStateAction<ProductVariantImage | null>>
}) {
    // If no images are provided, exit early and don't render anything
    if (!images) return

    return (
        <div className="relative">
            <div className="relative flex w-full flex-col-reverse gap-2 xl:flex-row">
                {/* Thumbnails */}
                <div className="flex flex-wrap gap-3 xl:flex-col">
                    {images.map((img) => (
                        <div
                            key={img.id}
                            className={cn(
                                'grid h-16 w-16 cursor-pointer place-items-center overflow-hidden rounded-md border border-gray-100 transition-all duration-75 ease-in',
                                {
                                    'border-main-primary': activeImage
                                        ? activeImage.id === img.id
                                        : false,
                                }
                            )}
                            onMouseEnter={() => setActiveImage(img)}
                        >
                            <Image
                                src={img.url}
                                alt={img.alt || 'Product image'}
                                width={80}
                                height={80}
                                className="rounded-md object-cover"
                                priority
                            />
                        </div>
                    ))}
                </div>
                {/* Image view */}
                <div className="relative overflow-hidden rounded-lg md:size-96 2xl:size-[600px]">
                    <ImageZoom
                        src={activeImage ? activeImage.url : ''}
                        zoom={200}
                        className="!w-full rounded-lg"
                    />
                </div>
            </div>
        </div>
    )
}
