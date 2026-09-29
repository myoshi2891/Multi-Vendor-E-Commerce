import { CartProductType } from '@/lib/types'
import { Size } from '@prisma/client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FC, useEffect, useCallback } from 'react'
import styles from '../product.module.css'

export type SizeWithPrice = Omit<Size, 'price'> & { price: number }

interface Props {
    sizes: SizeWithPrice[]
    sizeId: string | undefined
    handleChange: <K extends keyof CartProductType>(property: K, value: CartProductType[K]) => void
}

const SizeSelector: FC<Props> = ({ sizeId, sizes, handleChange }) => {
    const pathname = usePathname()
    const { replace } = useRouter()
    const searchParams = useSearchParams()
    const params = new URLSearchParams(searchParams)

    const handleSelectSize = (size: SizeWithPrice) => {
        // Update the sizeId in the search parameters and replace the current URL
        params.set('size', size.id)
        handleCartProductToBeAddedChange(size)
        replace(`${pathname}?${params.toString()}`)
    }

    const handleCartProductToBeAddedChange = useCallback((size: SizeWithPrice) => {
        handleChange('sizeId', size.id)
        handleChange('size', size.size)
    }, [handleChange])

    useEffect(() => {
        if (sizeId) {
            const search_size = sizes.find((s) => s.id === sizeId)
            if (search_size) {
                handleCartProductToBeAddedChange(search_size)
            }
        }
    }, [sizeId, sizes, handleCartProductToBeAddedChange])

    return (
        <div className={styles.sizeOptions}>
            {sizes.map((size) => (
                <button
                    type="button"
                    key={size.id}
                    className={styles.sizeOption}
                    aria-pressed={sizeId === size.id}
                    disabled={size.quantity <= 0}
                    data-testid={`size-option-${size.id}`}
                    onClick={() => handleSelectSize(size)}
                >
                    {size.size}
                </button>
            ))}
        </div>
    )
}

export default SizeSelector
