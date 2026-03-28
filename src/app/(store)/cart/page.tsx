import CartContainer from '@/components/store/cart-page/container'
import StoreHeader from '@/components/store/layout/header/header'
import { parseUserCountryCookie } from '@/lib/utils'
import { cookies } from 'next/headers'

/**
 * Server-rendered cart page that provides the parsed user country to the cart container.
 *
 * This component reads the `userCountry` cookie, parses it into a user country value, and renders
 * the store header followed by the cart container with the parsed `userCountry` prop.
 *
 * @returns A React fragment containing `StoreHeader` and `CartContainer` where `CartContainer`
 * receives the parsed user country (or `undefined` if the cookie is absent or invalid).
 */
export default async function CartPage() {
    const cookieStore = await cookies()
    const userCountry = parseUserCountryCookie(cookieStore.get('userCountry')?.value)

    // Return the CartContainer component with the userCountry prop
    return (
        <>
            <StoreHeader />
            <CartContainer userCountry={userCountry} />
        </>
    )
}
