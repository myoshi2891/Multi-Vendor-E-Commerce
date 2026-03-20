import { useCartStore } from '@/cart-store/useCartStore'
import useFromStore from '@/hooks/useFromStore'
import { CartProductType } from '@/lib/types'
import { Size } from '@prisma/client'
import { Minus, Plus } from 'lucide-react'
import { FC, useEffect, useMemo } from 'react'

interface QuantitySelectorProps {
    productId: string
    variantId: string
    sizeId: string | null
    quantity: number
    stock: number
    handleChange: <K extends keyof CartProductType>(property: K, value: CartProductType[K]) => void
}

const QuantitySelector: FC<QuantitySelectorProps> = ({
    handleChange,
    productId,
    variantId,
    sizeId,
    quantity,
    stock,
}) => {
    // useEffect hook to handle changes when sizeId updates
    useEffect(() => {
        if (sizeId && quantity !== 1) {
            handleChange('quantity', 1)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sizeId])
    // Get cart product if it exist in cart, the get added quantity
    const cart = useFromStore(useCartStore, (state) => state.cart)

    const maxQty = useMemo(() => {
        const search_product = cart?.find(
            (p) =>
                p.productId === productId &&
                p.variantId === variantId &&
                p.sizeId === sizeId
        )
        if (search_product) {
            return stock - search_product.quantity
        }
        return stock
    }, [cart, productId, variantId, sizeId, stock])

    // If no sizeId is provided, return null to prevent rendering the component
    // if (!sizeId) return null
    if (!sizeId) {
        return (
            <div className="w-full rounded-lg border border-gray-100 bg-white px-3 py-2">
                <div className="h-6 w-24 animate-pulse rounded bg-gray-200"></div>
            </div>
        )
    }

    // Function to handle increasing the quantity of the product
    const handleIncrease = () => {
        if (quantity < maxQty) {
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
                    <span className="block text-xs text-gray-500">
                        {maxQty !== stock &&
                            `(You already have ${stock - maxQty} pieces of this product in cart)`}
                    </span>
                    <input
                        type="number"
                        className="w-full border-0 bg-transparent p-0 text-gray-800 focus:outline-0"
                        min={1}
                        value={
                            maxQty <= 0
                                ? 0
                                : quantity <= maxQty
                                  ? quantity
                                  : maxQty
                        }
                        max={maxQty}
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
                        disabled={quantity >= maxQty}
                    >
                        <Plus className="w-3" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default QuantitySelector
