import { CartProductType } from '@/lib/types'
import { FC } from 'react'
import { Button } from '../ui/button'

interface Props {
    cartItems: CartProductType[]
    shippingFees: number
}

const CartSummary: FC<Props> = ({ cartItems, shippingFees }) => {
    // Calculate subtotal from cartItems
    const subtotal = cartItems.reduce((total, item) => {
        return total + item.price * item.quantity
    }, 0)

    // Calculate total price including shipping fees
    const total = subtotal + shippingFees

    return (
        <div className="relative bg-white px-6 py-4">
            <h1 className="mb-4 text-2xl font-bold text-gray-900">Summary</h1>
            <div className="mt-4 flex items-center text-sm font-medium text-[#222]">
                <h2 className="truncate break-normal">Subtotal</h2>
                <h3 className="w-0 min-w-0 flex-1 text-right">
                    <span className="px-0.5 text-2xl text-black">
                        <div className="inline-block break-all text-xl text-black">
                            ${subtotal.toFixed(2)}
                        </div>
                    </span>
                </h3>
            </div>
            <div className="mt-2 flex items-center text-sm font-medium text-[#222]">
                <h2 className="truncate break-normal">Shipping Fees</h2>
                <h3 className="w-0 min-w-0 flex-1 text-right">
                    <span className="px-0.5 text-2xl text-black">
                        <div className="inline-block break-all text-xl text-black">
                            +${shippingFees.toFixed(2)}
                        </div>
                    </span>
                </h3>
            </div>
            <div className="mt-2 flex items-center text-sm font-bold text-[#222]">
                <h2 className="truncate break-normal">Total</h2>
                <h3 className="w-0 min-w-0 flex-1 text-right">
                    <span className="px-0.5 text-2xl text-black">
                        <div className="inline-block break-all text-xl text-black">
                            ${total.toFixed(2)}
                        </div>
                    </span>
                </h3>
            </div>
            <div className="my-2.5">

            <Button >
                <span>Checkout ({cartItems.length})</span>
            </Button>
            </div>
        </div>
    )
}

export default CartSummary
