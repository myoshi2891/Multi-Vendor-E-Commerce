import { CartProductType } from '@/lib/types'
import { Size } from '@prisma/client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FC, useEffect } from 'react'

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

    const handleCartProductToBeAddedChange = (size: SizeWithPrice) => {
        handleChange('sizeId', size.id)
        handleChange('size', size.size)
    }

    useEffect(() => {
        if (sizeId) {
            const search_size = sizes.find((s) => s.id === sizeId)
            if (search_size) {
                handleCartProductToBeAddedChange(search_size)
            }
        }
    }, [sizeId, sizes, handleCartProductToBeAddedChange])

    return (
        <div className="flex flex-wrap gap-4">
            {sizes.map((size) => (
                <span
                    key={size.size}
                    className="cursor-pointer rounded-full border px-5 py-1 hover:border-black"
                    style={{ borderColor: sizeId === size.id ? '#000' : '' }}
                    data-testid={`size-option-${size.id}`}
                    onClick={() => handleSelectSize(size)}
                >
                    {size.size}
                </span>
            ))}
        </div>
    )
}

export default SizeSelector
