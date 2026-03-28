import CartContainer from '@/components/store/cart-page/container'
import StoreHeader from '@/components/store/layout/header/header'
import { parseUserCountryCookie } from '@/lib/utils'
import { cookies } from 'next/headers'

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
