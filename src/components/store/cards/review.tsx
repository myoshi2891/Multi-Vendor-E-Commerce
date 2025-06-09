'use client'
import ColorWheel from '@/components/shared/color-wheel'
import { ReviewWithImageType } from '@/lib/types'
import Image from 'next/image'
import ReactStars from 'react-rating-stars-component'

export default function ReviewCard({
    review,
}: {
    review: ReviewWithImageType
}) {
    const { user, images } = review
    const colors = review.color
        .split(',')
        .filter((color) => color.trim() !== '') //Remove any empty strings
        .map((color) => ({ name: color.trim() }))

    const { name } = user
    const censoredName = `${name[0]}***${name[name.length - 1]}`
    return (
        <div className="relative flex h-fit rounded-xl border border-[#d8d8d8] px-2.5 py-4">
            <div className="w-16 space-y-1 px-2">
                <Image
                    src={user.picture}
                    alt="Profile image"
                    width={100}
                    height={100}
                    priority
                    className="size-11 rounded-full object-cover"
                />
                <span className="text-xs text-main-secondary">
                    {censoredName.toUpperCase()}
                </span>
            </div>
            <div className="flex flex-1 flex-col justify-between overflow-hidden px-1.5 leading-5">
                <div className="space-y-2">
                    <ReactStars
                        count={5}
                        size={24}
                        color="#f5f5f5"
                        activeColor="#ffd804"
                        value={review.rating}
                        isHalf
                        edit={false}
                    />
                    <div className="flex items-center gap-x-2">
                        <ColorWheel colors={colors} size={24} />
                        <div className="text-sm text-main-secondary">
                            {review.variant}
                        </div>
                        <span>.</span>
                        <div className="text-sm text-main-secondary">
                            {review.size}
                        </div>
                        <span>.</span>
                        <div className="text-sm text-main-secondary">
                            {review.quantity} PC
                        </div>
                    </div>
                    <p className="text-sm">{review.review}</p>
                    {images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {images.map((img) => (
                                <div
                                    key={img.id}
                                    className="size-20 cursor-pointer overflow-hidden rounded-xl"
                                >
                                    <Image
                                        src={img.url}
                                        alt={img.alt}
                                        width={100}
                                        height={100}
                                        className="size-full object-cover"
                                        priority
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
