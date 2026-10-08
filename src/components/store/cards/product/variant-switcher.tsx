import { VariantImageType, VariantSimplified } from '@/lib/types'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import { Dispatch, FC, SetStateAction } from 'react'
import styles from './product-card.module.css'

interface Props {
    appearance?: "editorial"
    images: VariantImageType[]
    variants: VariantSimplified[]
    setVariant: Dispatch<SetStateAction<VariantSimplified>>
    selectedVariant: VariantSimplified
}
const VariantSwitcher: FC<Props> = ({
    images,
    appearance,
    variants,
    setVariant,
    selectedVariant,
}) => {
    return (
        <div>
            {images.length > 1 && (
                <div className="flex flex-wrap gap-1">
                    {images.map((img, index) => (
                        <Link
                            key={index}
                            href={img.url}
                            aria-label={`Choose ${variants[index]?.variantName ?? `variant ${index + 1}`}`}
                            aria-current={variants[index]?.variantId === selectedVariant.variantId ? "true" : undefined}
                            className={cn(
                                'rounded-full border-2 border-transparent p-0.5',
                                appearance === 'editorial' && styles.variantOption,
                                {
                                    'border-border':
                                        variants[index] === selectedVariant,
                                }
                            )}
                            onMouseEnter={() => { if (variants[index]) setVariant(variants[index]) }}
                            onFocus={() => { if (variants[index]) setVariant(variants[index]) }}
                        >
                            <Image
                                src={img.image}
                                alt=""
                                width={100}
                                height={100}
                                className="size-8 rounded-full object-cover"
                                priority
                            />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

export default VariantSwitcher
