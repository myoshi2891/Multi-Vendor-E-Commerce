'use client'
import {
    SerializedCartType,
    Country as CountryType,
    UserShippingAddressType,
} from '@/lib/types'
import { Country, ShippingAddress } from '@prisma/client'
import { FC, useEffect, useState } from 'react'
import UserShippingAddresses from '../shared/shipping-addresses/shipping-addresses'
import CheckoutProductCard from '../cards/checkout-product'
import PlaceOrderCard from '../cards/place-order'
import CountryNote from '../shared/country-note'
import { updateCheckoutProductWithLatest } from '@/queries/user'
import { isCouponCurrentlyValid } from '@/lib/coupon-utils'
import toast from 'react-hot-toast'

interface Props {
    cart: SerializedCartType
    countries: Country[]
    addresses: UserShippingAddressType[]
    userCountry: CountryType
}

const CheckoutContainer: FC<Props> = ({
    cart,
    countries,
    addresses,
    userCountry,
}) => {
    const [cartData, setCartData] = useState<SerializedCartType>(cart)

    const [selectedAddress, setSelectedAddress] =
        useState<ShippingAddress | null>(null)

    const activeCountry = addresses.find(
        (address) => address.countryId === selectedAddress?.countryId
    )?.country

    const { cartItems } = cart

    useEffect(() => {
        let cancelled = false

        const hydrateCheckoutCart = async () => {
            try {
                const updatedCart = await updateCheckoutProductWithLatest(
                    cartItems,
                    activeCountry
                )
                // アンマウント後 or 国が切り替わった後は、古いレスポンスで上書きしない
                if (!cancelled) setCartData(updatedCart)
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        '[CheckoutContainer:hydrateCheckoutCart] Failed to refresh checkout cart',
                        { error: error.message, stack: error.stack }
                    )
                } else {
                    console.error(
                        '[CheckoutContainer:hydrateCheckoutCart] Unknown error',
                        { error }
                    )
                }
                // 握りつぶさない: 失敗を伝えないと、古い金額のまま注文を確定できてしまう
                if (!cancelled) toast.error('Failed to refresh checkout details.')
            }
        }
        if (cartItems.length > 0) {
            hydrateCheckoutCart()
        }

        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCountry])

    return (
        <div className="flex">
            <div className="my-3 flex-1">
                <UserShippingAddresses
                    addresses={addresses}
                    countries={countries}
                    selectedAddress={selectedAddress}
                    setSelectedAddress={setSelectedAddress}
                />
                <div className="my-2">
                    <CountryNote
                        country={
                            activeCountry
                                ? activeCountry.name
                                : userCountry.name
                        }
                    />
                </div>
                <div className="my-3 size-4 w-full bg-white">
                    <div className="relative">
                        {cartData.cartItems.map((product) => (
                            <CheckoutProductCard
                                key={product.variantId}
                                product={product}
                                isDiscounted={
                                    cartData.coupon !== null &&
                                    isCouponCurrentlyValid(cartData.coupon) &&
                                    (cartData.coupon.scope === 'PLATFORM' ||
                                        cartData.coupon.storeId === product.storeId)
                                }
                            />
                        ))}
                    </div>
                </div>
            </div>
            <PlaceOrderCard
                cartData={cartData}
                setCartData={setCartData}
                shippingAddress={selectedAddress}
            />
        </div>
    )
}

export default CheckoutContainer
