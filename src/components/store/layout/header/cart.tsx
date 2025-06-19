'use client'
import Link from 'next/link'
import { CartIcon } from '@/components/store/icons'
import { useCartStore } from '@/cart-store/useCartStore'

export default function Cart() {
    // Get total items in the cart
    const totalItems = useCartStore((state) => state.totalItems)
    return (
        <div className="relative flex h-11 cursor-pointer items-center px-2">
            <Link href="/cart" className="flex items-center text-white">
                <span className="inline-block text-[32px]">
                    <CartIcon />
                </span>
                <div className="ml-1">
                    <div className="-mt-1.5 min-h-3 min-w-6">
                        <span className="inline-block min-h-3 min-w-6 rounded-lg bg-white px-1 text-center text-xs font-bold leading-4 text-main-primary">
                            {totalItems}
                        </span>
                    </div>
                    <b className="text-wrap text-xs font-bold leading-4">
                        Cart
                    </b>
                </div>
            </Link>
        </div>
    )
}
