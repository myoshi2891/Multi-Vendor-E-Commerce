import { useCartStore } from '@/cart-store/useCartStore'
import { CartProductType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { Dispatch, FC, SetStateAction } from 'react'

interface Props {
    cartItems: CartProductType[]
    selectedItems: CartProductType[]
    setSelectedItems: Dispatch<SetStateAction<CartProductType[]>>
}
const CartHeader: FC<Props> = ({
    cartItems,
    selectedItems,
    setSelectedItems,
}) => {
    const removeMultipleFromCart = useCartStore(
        (state) => state.removeMultipleFromCart
    )
    const cartLength = cartItems.length
    const selectedLength = selectedItems.length

    const handleSelectAll = () => {
        const areAllSelected = cartItems.every((item) =>
            selectedItems.some(
                (selected) =>
                    selected.productId === item.productId &&
                    selected.variantId === item.variantId &&
                    selected.sizeId === item.sizeId
            )
        )
        setSelectedItems(areAllSelected ? [] : cartItems)
    }
    const removeSelectedFromCart = () => {
        removeMultipleFromCart(selectedItems)

        // Remove the selected items from both cart and selectedItems
        setSelectedItems((prevSelectedItems) =>
            prevSelectedItems.filter(
                (selected) =>
                    !cartItems.some(
                        (item) =>
                            selected.productId === item.productId &&
                            selected.variantId === item.variantId &&
                            selected.sizeId === item.sizeId
                    )
            )
        )
    }
    return (
        <div className="bg-white py-4">
            <div>
                <div className="bg-white px-6">
                    <div className="flex items-center text-2xl font-bold text-[#222]">
                        <h1>Cart ({cartLength})</h1>
                    </div>
                </div>
                <div className="flex justify-between bg-white px-6 pt-4">
                    <div className="flex w-full items-center justify-start">
                        <label
                            className="m-0 mr-2 inline-flex cursor-pointer list-none items-center p-0 align-middle text-sm leading-6 text-gray-900"
                            onClick={() => handleSelectAll()}
                        >
                            <span className="inline-flex cursor-pointer p-0.5 leading-8">
                                <span
                                    className={cn(
                                        'flex size-5 items-center justify-center rounded-full border border-gray-300 bg-white leading-8 hover:border-orange-background',
                                        {
                                            'border-orange-background':
                                                cartLength > 0 &&
                                                selectedLength === cartLength,
                                        }
                                    )}
                                >
                                    {cartLength > 0 &&
                                        selectedLength === cartLength && (
                                            <span className="flex size-5 items-center justify-center rounded-full bg-orange-background">
                                                <Check className="mt-0.5 w-3.5 text-white" />
                                            </span>
                                        )}
                                </span>
                            </span>
                            <span className="select-none px-2 leading-8">
                                Select all products
                            </span>
                        </label>
                        {selectedLength > 0 && (
                            <div
                                className="cursor-pointer border-l border-l-[#ebebeb] pl-4"
                                onClick={() => removeSelectedFromCart()}
                            >
                                <div className="text-sm font-semibold leading-5 text-[#3170ee]"></div>
                                Delete all selected products
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CartHeader
