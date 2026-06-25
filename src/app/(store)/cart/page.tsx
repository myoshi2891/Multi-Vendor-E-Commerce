import CartContainer from '@/components/store/cart-page/container'
import { parseUserCountryCookie } from '@/lib/utils'
import { cookies } from 'next/headers'

/**
 * Server-rendered cart page that provides the parsed user country to the cart container.
 *
 * This component reads the `userCountry` cookie, parses it into a user country value, and renders
 * the cart container with the parsed `userCountry` prop. The store header/footer は (store)
 * レイアウトが供給する。
 *
 * @returns `CartContainer` を返す。`CartContainer` は解析済みのユーザー国
 * （cookie が無い/不正な場合は `undefined`）を受け取る。
 */
export default async function CartPage() {
    const cookieStore = await cookies()
    const userCountry = parseUserCountryCookie(cookieStore.get('userCountry')?.value)

    // Return the CartContainer component with the userCountry prop
    return <CartContainer userCountry={userCountry} />
}
