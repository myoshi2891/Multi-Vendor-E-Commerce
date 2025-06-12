import { CartWithCartItemsType } from '@/lib/types'
import { Country } from '@prisma/client'
import { FC } from 'react'

interface Props {
    cart: CartWithCartItemsType
    countries: Country[]
}

const CheckoutContainer: FC<Props> = ({cart, countries}) => {
    return (
        <div className="flex">
            <div className="my-3 flex-1">
                {/* UserShippingAddresses */}
                <div className="my-3 size-4 w-full bg-white">
                    <div className="relative">
                        {
                            cart.cartItems.map((product) => (
                                // CheckoutProductCard
                                <div key={product.id}></div>
                            ))
                        }
                    </div>
                </div>
            </div>
            {/* Cart Side */}
            {/* PlaceOrderCard */}
        </div>
    )
}

export default CheckoutContainer
