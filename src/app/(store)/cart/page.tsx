import CartContainer from '@/components/store/cart-page/container'
import { parseUserCountryCookie } from '@/lib/utils'
import { cookies } from 'next/headers'

/**
 * Renders the cart page with the parsed user country.
 *
 * Reads the `userCountry` cookie, converts it to a user country value, and passes it to
 * `CartContainer`.
 *
 * @returns The cart container rendered with the parsed `userCountry` value.
 */
export default async function CartPage() {
    const cookieStore = await cookies()
    const userCountry = parseUserCountryCookie(cookieStore.get('userCountry')?.value)

    // Return the CartContainer component with the userCountry prop
    return <CartContainer userCountry={userCountry} />
}
