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
                            key={img.url}
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
