import { useCartStore } from '@/cart-store/useCartStore'
import { emptyUserCart, placeOrder } from '@/queries/user'
import { Coupon, ShippingAddress } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { Dispatch, FC, SetStateAction } from 'react'
import toast from 'react-hot-toast'
import { SecurityPrivacyCard } from '../product-page/returns-security-privacy-card'
import { Button } from '../ui/button'
import FastDelivery from './fast-delivery'
import { cn } from '@/lib/utils'
import { CartWithCartItemsType } from '@/lib/types'
import ApplyCouponForm from '../forms/apply-coupon'

interface Props {
    shippingFees: number
    subTotal: number
    total: number
    shippingAddress: ShippingAddress | null
    cartId: string
    cartData: CartWithCartItemsType
    setCartData: Dispatch<SetStateAction<CartWithCartItemsType>>
    coupon: Coupon | null
}

const PlaceOrderCard: FC<Props> = ({
    shippingFees,
    subTotal,
    total,
    shippingAddress,
    cartId,
    setCartData,
    coupon,
    cartData,
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

    let discountedAmount = 0
    const applicableStoreItems = cartData.cartItems.filter(
        (item) => item.storeId === coupon?.storeId
    )

    const storeSubTotal = applicableStoreItems.reduce(
        (acc, item) => acc + item.price * item.quantity + item.shippingFee,
        0
    )

    if (coupon) {
        discountedAmount = (storeSubTotal * coupon.discount) / 100
        total -= discountedAmount
    }

    return (
        <div className="sticky top-4 ml-5 mt-3 max-h-max w-[380px]">
            <div className="relative bg-white px-6 py-4">
                <h1 className="mb-4 text-2xl font-bold text-gray-900">
                    Summary
                </h1>
                <Info title="Subtotal" text={`${subTotal.toFixed(2)}`} />
                <Info
                    title="Shipping Fees"
                    text={`+${shippingFees.toFixed(2)}`}
                />
                {coupon && (
                    <Info
                        title={`Coupon (${coupon.code}) (-${coupon.discount}%)`}
                        text={`-$${discountedAmount.toFixed(2)}`}
                    />
                )}
                <Info title="Taxes" text="+0.00" />
                <Info
                    title="Total"
                    text={`${total.toFixed(2)}`}
                    isBold
                    noBorder
                />
                <div className="mt-2">
                    <div className="bg-white">
                        <ApplyCouponForm
                            cartId={cartId}
                            setCartData={setCartData}
                        />
                    </div>
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

const Info = ({
    title,
    text,
    isBold,
    noBorder,
}: {
    title: string
    text: string
    isBold?: boolean
    noBorder?: boolean
}) => {
    return (
        <div
            className={cn(
                'mt-2 flex items-center border-b pb-1 text-sm font-medium text-[#222]',
                {
                    'font-bold': isBold,
                    'border-b-0': noBorder,
                }
            )}
        >
            <h2 className="truncate break-normal">{title}</h2>
            <h3 className="w-0 min-w-0 flex-1 text-right">
                <span className="px-0.5 text-black">
                    <div className="inline-block break-all text-lg text-black">
                        {text}
                    </div>
                </span>
            </h3>
        </div>
    )
}
