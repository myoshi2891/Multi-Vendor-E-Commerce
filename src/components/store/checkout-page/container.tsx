'use client'
import {
    CartWithCartItemsType,
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

interface Props {
    cart: CartWithCartItemsType
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
    const [cartData, setCartData] = useState<CartWithCartItemsType>(cart)

    const [selectedAddress, setSelectedAddress] =
        useState<ShippingAddress | null>(null)

    const activeCountry = addresses.find(
        (address) => address.countryId === selectedAddress?.countryId
    )?.country

    console.log(activeCountry)

    const { cartItems } = cart

    useEffect(() => {
        const hydrateCheckoutCart = async () => {
            const updatedCart = await updateCheckoutProductWithLatest(
                cartItems,
                activeCountry
            )
            setCartData(updatedCart)
        }
        if (cartItems.length > 0) {
            hydrateCheckoutCart()
        }
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
                            />
                        ))}
                    </div>
                </div>
            </div>
            <PlaceOrderCard
                cartId={cart.id}
                shippingAddress={selectedAddress}
                shippingFees={cartData.shippingFees}
                subTotal={cartData.subTotal}
                total={cartData.total}
                setCartData={setCartData}
                coupon={cartData.coupon}
                cartData={cartData}
            />
        </div>
    )
}

export default CheckoutContainer
