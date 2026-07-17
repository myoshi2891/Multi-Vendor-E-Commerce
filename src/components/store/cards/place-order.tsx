import { useCartStore } from '@/cart-store/useCartStore'
import { emptyUserCart, placeOrder } from '@/queries/user'
import { Coupon, ShippingAddress } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { Dispatch, FC, SetStateAction, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { SecurityPrivacyCard } from '../product-page/returns-security-privacy-card'
import { Button } from '../ui/button'
import FastDelivery from './fast-delivery'
import { cn } from '@/lib/utils'
import { logError } from '@/lib/log'
import { SerializedCartType } from '@/lib/types'
import ApplyCouponForm from '../forms/apply-coupon'
import { PulseLoader } from 'react-spinners'

interface Props {
    shippingAddress: ShippingAddress | null
    cartData: SerializedCartType
    setCartData: Dispatch<SetStateAction<SerializedCartType>>
}

const PlaceOrderCard: FC<Props> = ({
    shippingAddress,
    setCartData,
    cartData,
}) => {
    const [loading, setLoading] = useState<boolean>(false)
    const isPlacingOrderRef = useRef(false)
    const { id, coupon, subTotal, shippingFees, total } = cartData
    const { push } = useRouter()
    const emptyCart = useCartStore((state) => state.emptyCart)
    const handlePlaceOrder = async () => {
        if (isPlacingOrderRef.current) return
        isPlacingOrderRef.current = true
        setLoading(true)
        // push() は戻り値が void で await できず、遷移完了まで本コンポーネントは
        // マウントされたままになる。注文成立後にガードを解除すると遷移中にボタンが
        // 再有効化され、カート削除済みの状態で placeOrder が再実行されてしまう
        // （"Cart not found." で失敗し、成功したのに誤エラーが表示される）。
        let orderPlaced = false
        try {
            if (!shippingAddress) {
                toast.error('Select a shipping address before placing your order.')
                return
            }
            const order = await placeOrder(shippingAddress, id)
            if (order) {
                // 注文成立は不可逆。この時点でガードを恒久化し、以降の後片付けが
                // 失敗しても再注文させない。
                orderPlaced = true
                emptyCart()
                try {
                    await emptyUserCart()
                } catch (error: unknown) {
                    // カートの後片付け失敗は注文成立を取り消さないため、
                    // ログのみに留めて遷移を継続する。
                    logError('[PlaceOrder:handlePlaceOrder] cart cleanup failed', error)
                }
                push(`/order/${order.orderId}`)
            }
        } catch (error: unknown) {
            logError('[PlaceOrder:handlePlaceOrder] failed to place order', error)
            toast.error('Something went wrong while placing your order.')
        } finally {
            // 注文成立後は解除しない（アンマウント前提の意図的な例外）。
            // 失敗・住所未選択時のみ解除して再試行を許可する。
            if (!orderPlaced) {
                isPlacingOrderRef.current = false
                setLoading(false)
            }
        }
    }

    let discountedAmount = 0
    const isPlatformCoupon = coupon?.scope === 'PLATFORM'
    const applicableStoreItems = isPlatformCoupon
        ? cartData.cartItems
        : cartData.cartItems.filter((item) => item.storeId === coupon?.storeId)

    const storeSubTotal = applicableStoreItems.reduce(
        (acc, item) => acc + Number(item.price) * item.quantity + Number(item.shippingFee),
        0
    )

    if (coupon) {
        discountedAmount = (storeSubTotal * coupon.discount) / 100
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
            </div>
            <div className="mt-2">
                {coupon ? (
                    <div className="flex bg-white">
                        <svg
                            width={16}
                            height={96}
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M 8 0 
         Q 4 4.8, 8 9.6 
         T 8 19.2 
         Q 4 24, 8 28.8 
         T 8 38.4 
         Q 4 43.2, 8 48 
         T 8 57.6 
         Q 4 62.4, 8 67.2 
         T 8 76.8 
         Q 4 81.6, 8 86.4 
         T 8 96 
         L 0 96 
         L 0 0 
         Z"
                                fill="#66cdaa"
                                stroke="#66cdaa"
                                strokeWidth={2}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="mx-2.5 w-full overflow-hidden">
                            <p className="mr-3 mt-1.5 truncate text-xl font-bold leading-8 text-[#66cdaa]">
                                Coupon applied !
                            </p>
                            <p className="max-h-10 overflow-hidden break-all leading-5 text-zinc-400">
                                ({coupon.code}) ({coupon.discount}% off)
                                discount
                            </p>
                            <p className="overflow-hidden break-words text-sm leading-5 text-zinc-400">
                                Coupon applied only to items from&nbsp;
                                {coupon.store?.name ?? '全店舗'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white">
                        <ApplyCouponForm
                            cartId={id}
                            setCartData={setCartData}
                        />
                    </div>
                )}
            </div>
            <div className="mt-2 bg-white p-4">
                <Button onClick={() => handlePlaceOrder()} disabled={loading}>
                    {loading ? (
                        <PulseLoader size={5} color="#fff" />
                    ) : (
                        <span>Place order</span>
                    )}
                </Button>
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
