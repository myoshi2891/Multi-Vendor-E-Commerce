import CheckoutContainer from '@/components/store/checkout-page/container'
import StoreHeader from '@/components/store/layout/header/header'
import { db } from '@/lib/db'
import { parseUserCountryCookie } from '@/lib/utils'
import { serializeCart } from '@/lib/serialize-cart'
import { getUserShippingAddresses } from '@/queries/user'
import { currentUser } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic';

/**
 * Renders the checkout page for an authenticated user.
 *
 * Redirects to `/cart` if the user is not authenticated or does not have a cart.
 *
 * @returns The checkout page JSX.
 */
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
            coupon: {
                include: {
                    store: true,
                },
            },
        },
    });

    if (!cart) redirect('/cart')

    // Get user shipping address
    const addresses = await getUserShippingAddresses()

    // Get list of countries
    const countries = await db.country.findMany({
        orderBy: { name: 'desc' },
    })

    const cookieStore = await cookies()
    const userCountry = parseUserCountryCookie(cookieStore.get('userCountry')?.value)

    const serializedCart = serializeCart(cart)

    return (
        <>
            <StoreHeader />
            <div className="min-h-[calc(100vh-65px)] bg-[#f4f4f4]">
                <div className="mx-auto max-w-container px-2 py-5">
                    <CheckoutContainer
                        cart={serializedCart}
                        countries={countries}
                        addresses={addresses}
                        userCountry={userCountry}
                    />
                </div>
            </div>
        </>
    )
}
