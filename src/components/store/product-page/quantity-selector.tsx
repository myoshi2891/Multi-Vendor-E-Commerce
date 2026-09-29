import { useCartStore } from '@/cart-store/useCartStore'
import useFromStore from '@/hooks/useFromStore'
import { CartProductType } from '@/lib/types'
import { Minus, Plus } from 'lucide-react'
import { FC, useEffect, useId, useMemo } from 'react'
import styles from './product.module.css'

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

    // 可視ラベル "Select quantity" を input のアクセシブル名として参照させる ID。
    // 商品ページに複数描画されても衝突しないよう useId で一意化する。
    // フックは早期リターン（下の !sizeId 分岐）より前に置くこと。
    const quantityLabelId = useId()

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
        <div className={styles.quantityControl}>
                <div>
                    <label htmlFor={quantityLabelId}>Select quantity</label>
                    <p>
                        {maxQty !== stock &&
                            `(You already have ${stock - maxQty} pieces of this product in cart)`}
                    </p>
                </div>
                <div className={styles.quantityStepper}>
                    <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={handleDecrease}
                        disabled={quantity === 1}
                    ><Minus size={13} /></button>
                    <input
                        type="number"
                        id={quantityLabelId}
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
                    <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={handleIncrease}
                        disabled={quantity >= maxQty}
                    ><Plus size={13} /></button>
                </div>
        </div>
    )
}

export default QuantitySelector
