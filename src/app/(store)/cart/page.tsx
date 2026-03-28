import CartContainer from '@/components/store/cart-page/container'
import StoreHeader from '@/components/store/layout/header/header'
import { Country } from '@/lib/types'
import { cookies } from 'next/headers'

export default async function CartPage() {
    // Get cookies from the store
    const cookieStore = await cookies()
    const userCountryCookie = cookieStore.get('userCountry')

    // Set default country if cookie is missing
    let userCountry: Country = {
        name: 'United States',
        code: 'US',
        city: '',
        region: '',
    }

    // If cookie exists, parse it and update user Country
    if (userCountryCookie) {
        try {
            userCountry = JSON.parse(userCountryCookie.value) as Country
        } catch {
            // 不正な cookie は無視し、デフォルト値を使用
        }
    }

    // Return the CartContainer component with the userCountry prop
    return (
        <>
            <StoreHeader />
            <CartContainer userCountry={userCountry} />
        </>
    )
}
