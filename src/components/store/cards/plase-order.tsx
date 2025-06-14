import { useCartStore } from '@/cart-store/useCartStore'
import { emptyUserCart, placeOrder } from '@/queries/user'
import { ShippingAddress } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { FC } from 'react'
import toast from 'react-hot-toast'
import { SecurityPrivacyCard } from '../product-page/returns-security-privacy-card'
import { Button } from '../ui/button'
import FastDelivery from './fast-delivery'

interface Props {
    shippingFees: number
    subTotal: number
    total: number
    shippingAddress: ShippingAddress | null
    cartId: string
}

const PlaceOrderCard: FC<Props> = ({
    shippingFees,
    subTotal,
    total,
    shippingAddress,
    cartId,
}) => {
    const { push } = useRouter()
    const emptyCart = useCartStore((state) => state.emptyCart)
    const handlePlaceOrder = async () => {
        if (!shippingAddress) {
            toast.error('Select a shipping address before placing your order.')
        } else {
            const order = await placeOrder(shippingAddress, cartId)
            if (order) {
                emptyCart()
                await emptyUserCart()
                push(`/order/${order.orderId}`)
            }
        }
    }
    return (
        <div className="sticky top-4 ml-5 mt-3 max-h-max w-[380px]">
            <div className="relative bg-white px-6 py-4">
                <h1 className="mb-4 text-2xl font-bold text-gray-900">
                    Summary
                </h1>
                <div className="mt-4 flex items-center text-sm font-medium text-[#222]">
                    <h2 className="truncate break-normal">Subtotal</h2>
                    <h3 className="w-0 min-w-0 flex-1 text-right">
                        <span className="px-0.5 text-2xl text-black">
                            <div className="inline-block break-all text-xl text-black">
                                ${subTotal.toFixed(2)}
                            </div>
                        </span>
                    </h3>
                </div>
                <div className="mt-4 flex items-center text-sm font-medium text-[#222]">
                    <h2 className="truncate break-normal">Shipping fees</h2>
                    <h3 className="w-0 min-w-0 flex-1 text-right">
                        <span className="px-0.5 text-2xl text-black">
                            <div className="inline-block break-all text-xl text-black">
                                ${shippingFees.toFixed(2)}
                            </div>
                        </span>
                    </h3>
                </div>
                <div className="mt-4 flex items-center text-sm font-bold text-[#222]">
                    <h2 className="truncate break-normal">Total</h2>
                    <h3 className="w-0 min-w-0 flex-1 text-right">
                        <span className="px-0.5 text-2xl text-black">
                            <div className="inline-block break-all text-xl text-black">
                                ${total.toFixed(2)}
                            </div>
                        </span>
                    </h3>
                </div>
                <div className="pt-2.5">
                    <Button onClick={() => handlePlaceOrder()}>
                        <span>Place Order</span>
                    </Button>
                </div>
            </div>
            <div className="mt-2 bg-white p-4 px-6">
                <FastDelivery />
            </div>
            <div className="mt-2 bg-white p-4 px-6">
                <SecurityPrivacyCard />
            </div>
        </div>
    )
}

export default PlaceOrderCard
