'use client'

import { useCartStore } from '@/cart-store/useCartStore'
import FastDelivery from '@/components/store/cards/fast-delivery'
import { SecurityPrivacyCard } from '@/components/store/product-page/returns-security-privacy-card'
import useFromStore from '@/hooks/useFromStore'
import { CartProductType } from '@/lib/types'
import { useState } from 'react'

export default function CartPage() {
    const cartItems = useFromStore(useCartStore, (state) => state.cart)

    const [selectedItems, setSelectedItems] = useState<CartProductType[]>([])
    const [totalShipping, setTotalShipping] = useState<number>(0)

    return (
        <div>
            {cartItems && cartItems?.length > 0 ? (
                <div className="bg-[#f5f5f5]">
                    <div className="mx-auto flex max-w-[1200px] py-6">
                        <div className="min-w-0 flex-1">
                            {/* Cart header */}
                            <div className="mt-2 h-auto overflow-auto overflow-x-hidden">
                                {/* Cart items */}
                            </div>
                        </div>
                        {/* Cart side */}
                        <div className="sticky top-4 ml-5 max-h-max w-[380px]">
                            {/* Cart summary */}
                            <div className="mt-2 bg-white p-4 px-6">
                                <FastDelivery />
                            </div>
                            <div className="mt-2 bg-white p-4 px-6">
                                <SecurityPrivacyCard />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex h-screen items-center justify-center">
                    <div className="text-center text-2xl text-main-primary">
                        Your cart is empty
                    </div>
                </div>
            )}
        </div>
    )
}
