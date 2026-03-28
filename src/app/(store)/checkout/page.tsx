import CheckoutContainer from '@/components/store/checkout-page/container'
import StoreHeader from '@/components/store/layout/header/header'
import { db } from '@/lib/db'
import { parseUserCountryCookie } from '@/lib/utils'
import { getUserShippingAddresses } from '@/queries/user'
import { currentUser } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Renders the checkout page after loading the authenticated user's cart, shipping addresses, country list, and resolved user country.
 *
 * Fetches the current user, the user's cart (including cart items and coupon with its store), the user's shipping addresses, the list of countries ordered by name descending, and the `userCountry` value parsed from cookies. If no authenticated user or no cart is found, redirects to `/cart`.
 *
 * @returns The checkout page JSX ready to be rendered, containing the store header and the checkout container populated with `cart`, `countries`, `addresses`, and `userCountry`.
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

    return (
        <>
            <StoreHeader />
            <div className="min-h-[calc(100vh-65px)] bg-[#f4f4f4]">
                <div className="mx-auto max-w-container px-2 py-5">
                    <CheckoutContainer
                        cart={cart}
                        countries={countries}
                        addresses={addresses}
                        userCountry={userCountry}
                    />
                </div>
            </div>
        </>
    )
}
