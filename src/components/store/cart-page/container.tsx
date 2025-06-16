'use client'
import { useCartStore } from '@/cart-store/useCartStore'
import useFromStore from '@/hooks/useFromStore'
import { CartProductType, Country } from '@/lib/types'
import { useState } from 'react'
import CartHeader from './cart-header'
import CartProduct from '../cards/cart-product'
import FastDelivery from '../cards/fast-delivery'
import { SecurityPrivacyCard } from '../product-page/returns-security-privacy-card'
import EmptyCart from './empty-cart'
import CartSummary from './summary'

export default function CartContainer({
    userCountry,
}: {
    userCountry: Country
}) {
    const cartItems = useFromStore(useCartStore, (state) => state.cart)

    const [loading, setLoading] = useState<boolean>(false)
    const [selectedItems, setSelectedItems] = useState<CartProductType[]>([])
    const [totalShipping, setTotalShipping] = useState<number>(0)

    return (
        <div>
            {cartItems && cartItems?.length > 0 ? (
                <>
                    {loading ? (
                        <div>loading...</div>
                    ) : (
                        <div className="min-h-[calc(100vh-65px)] bg-[#f5f5f5]">
                            <div className="mx-auto flex max-w-container py-6">
                                <div className="min-w-0 flex-1">
                                    {/* Cart header */}
                                    <CartHeader
                                        cartItems={cartItems}
                                        selectedItems={selectedItems}
                                        setSelectedItems={setSelectedItems}
                                    />
                                    <div className="mt-2 h-auto overflow-auto overflow-x-hidden">
                                        {/* Cart items */}
                                        {cartItems.map((product, i) => (
                                            <CartProduct
                                                key={i}
                                                product={product}
                                                selectedItems={selectedItems}
                                                setSelectedItems={
                                                    setSelectedItems
                                                }
                                                setTotalShipping={
                                                    setTotalShipping
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                                {/* Cart side */}
                                <div className="sticky top-4 ml-5 max-h-max w-[380px]">
                                    {/* Cart summary */}
                                    <CartSummary
                                        cartItems={cartItems}
                                        shippingFees={totalShipping}
                                    />
                                    <div className="mt-2 bg-white p-4 px-6">
                                        <FastDelivery />
                                    </div>
                                    <div className="mt-2 bg-white p-4 px-6">
                                        <SecurityPrivacyCard />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <EmptyCart />
            )}
        </div>
    )
}
