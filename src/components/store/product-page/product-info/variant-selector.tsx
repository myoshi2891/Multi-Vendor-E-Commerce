import { VariantInfoType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ProductVariantImage } from '@prisma/client'
import Image from 'next/image'
import Link from 'next/link'
import { Dispatch, FC, SetStateAction } from 'react'

interface Props {
    variants: VariantInfoType[]
    slug: string
    setVariantImages: Dispatch<SetStateAction<ProductVariantImage[]>>
    setActiveImage: Dispatch<SetStateAction<ProductVariantImage | null>>
}

const ProductVariantSelector: FC<Props> = ({
    variants,
    slug,
    setVariantImages,
    setActiveImage,
}) => {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {variants.map((variant, i) => (
                <Link
                    href={variant.variantUrl}
                    key={i}
                    onMouseEnter={() => {
                        setVariantImages(variant.images)
                        setActiveImage(variant.images[0])
                    }}
                    onMouseLeave={() => {
                        setVariantImages([])
                        setActiveImage(null)
                    }}
                >
                    <div
                        className={cn(
                            'grid h-12 w-12 cursor-pointer place-items-center overflow-hidden rounded-full border border-transparent p-0.5 transition-all duration-75 ease-in hover:border-main-primary',
                            {
                                'border-main-primary':
                                    slug === variant.variantSlug,
                            }
                        )}
                    >
                        <Image
                            src={variant.variantImage}
                            alt={`product variant ${variant.variantUrl}`}
                            width={48}
                            height={48}
                            className="rounded-full"
                            priority
                        />
                    </div>
                </Link>
            ))}
        </div>
    )
}

export default ProductVariantSelector
