import { CartProductType } from '@/lib/types'
import { Size } from '@prisma/client'
import { Minus, Plus } from 'lucide-react'
import { FC, useEffect } from 'react'

interface QuantitySelectorProps {
    productId: string
    variantId: string
    sizeId: string | null
    quantity: number
    stock: number
    handleChange: (property: keyof CartProductType, value: any) => void
    sizes: Size[]
}

const QuantitySelector: FC<QuantitySelectorProps> = ({
    handleChange,
    productId,
    variantId,
    sizeId,
    quantity,
    stock,
    sizes,
}) => {
    // If no sizeId is provided, return null to prevent rendering the component
    if (!sizeId) return null

    // useEffect hook to handle changes when sizeId updates
    useEffect(() => {
        handleChange('quantity', 1)
    }, [sizeId, handleChange])

    // Function to handle increasing the quantity of the product
    const handleIncrease = () => {
        if (quantity < stock) {
            handleChange('quantity', quantity + 1)
        }
    }

    // Function to handle decreasing the quantity of the product
    const handleDecrease = () => {
        if (quantity > 1) {
            handleChange('quantity', quantity - 1)
        }
    }

    return (
        <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
            <div className="flex w-full items-center justify-between gap-x-5">
                <div className="grow">
                    <span className="block text-xs text-gray-500">
                        Select quantity
                    </span>
                    <input
                        type="number"
                        className="w-full border-0 bg-transparent p-0 text-gray-800 focus:outline-0"
                        min={1}
                        value={quantity}
                        readOnly
                    />
                </div>
                <div className="flex items-center justify-end gap-x-1.5">
                    <button
                        onClick={handleDecrease}
                        className="inline-flex size-6 items-center justify-center gap-x-2 rounded-full border border-gray-200 bg-white text-sm font-medium shadow-sm focus:bg-gray-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
                        disabled={quantity === 1}
                    >
                        <Minus className="w-3" />
                    </button>
                    <button
                        onClick={handleIncrease}
                        className="inline-flex size-6 items-center justify-center gap-x-2 rounded-full border border-gray-200 bg-white text-sm font-medium shadow-sm focus:bg-gray-50 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
                        disabled={quantity === stock}
                    >
                        <Plus className="w-3" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default QuantitySelector
