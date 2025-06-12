'use client'
import { CartWithCartItemsType, UserShippingAddressType } from '@/lib/types'
import { Country, ShippingAddress } from '@prisma/client'
import { FC, useState } from 'react'
import UserShippingAddresses from '../shared/shipping-addresses/shipping-addresses'

interface Props {
    cart: CartWithCartItemsType
    countries: Country[]
    addresses: UserShippingAddressType[]
}

const CheckoutContainer: FC<Props> = ({ cart, countries, addresses }) => {
    const [selectedAddress, setSelectedAddress] =
        useState<ShippingAddress | null>(null)
    return (
        <div className="flex">
            <div className="my-3 flex-1">
                <UserShippingAddresses
                    addresses={addresses}
                    countries={countries}
                    selectedAddress={selectedAddress}
                    setSelectedAddress={setSelectedAddress}
                />
                <div className="my-3 size-4 w-full bg-white">
                    <div className="relative">
                        {cart.cartItems.map((product) => (
                            // CheckoutProductCard
                            <div key={product.id}></div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Cart Side */}
            {/* PlaceOrderCard */}
        </div>
    )
}

export default CheckoutContainer
