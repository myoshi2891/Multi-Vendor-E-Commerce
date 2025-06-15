import CheckoutContainer from '@/components/store/checkout-page/container'
import StoreHeader from '@/components/store/layout/header/header'
import { db } from '@/lib/db'
import { getUserShippingAddresses } from '@/queries/user'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function CheckoutPage() {
    const user = await currentUser()
    if (!user) {
        redirect('/cart')
    }

    // Get user cart
    const cart = await db.cart.findFirst({
        where: {
            userId: user.id,
        },
        include: {
            cartItems: true,
        },
    })

    if (!cart) redirect('/cart')

    // Get user shipping address
    const addresses = await getUserShippingAddresses()

    // Get list of countries
    const countries = await db.country.findMany({
        orderBy: { name: 'desc' },
    })

    return (
        <>
            <StoreHeader />
            <div className="min-h-[calc(100vh-65px)] bg-[#f4f4f4]">
                <div className="mx-auto max-w-container px-2 py-5">
                    <CheckoutContainer
                        cart={cart}
                        countries={countries}
                        addresses={addresses}
                    />
                </div>
            </div>
        </>
    )
}
