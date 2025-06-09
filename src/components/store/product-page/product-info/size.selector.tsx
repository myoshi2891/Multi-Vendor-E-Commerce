import { CartProductType } from '@/lib/types'
import { Size } from '@prisma/client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FC, useEffect } from 'react'

interface Props {
    sizes: Size[]
    sizeId: string | undefined
    handleChange: (property: keyof CartProductType, value: any) => void
}

const SizeSelector: FC<Props> = ({ sizeId, sizes, handleChange }) => {
    const pathname = usePathname()
    const { replace } = useRouter()
    const searchParams = useSearchParams()
    const params = new URLSearchParams(searchParams)

    const handleSelectSize = (size: Size) => {
        // Update the sizeId in the search parameters and replace the current URL
        params.set('size', size.id)
        handleCartProductToBeAddedChange(size)
        replace(`${pathname}?${params.toString()}`)
    }

    const handleCartProductToBeAddedChange = (size: Size) => {
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
    }, [])

    return (
        <div className="flex flex-wrap gap-4">
            {sizes.map((size) => (
                <span
                    key={size.size}
                    className="cursor-pointer rounded-full border px-5 py-1 hover:border-black"
                    style={{ borderColor: sizeId === size.id ? '#000' : '' }}
                    onClick={() => handleSelectSize(size)}
                >
                    {size.size}
                </span>
            ))}
        </div>
    )
}

export default SizeSelector
