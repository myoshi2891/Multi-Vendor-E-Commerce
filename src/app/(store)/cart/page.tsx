import CartContainer from '@/components/store/cart-page/container'
import StoreHeader from '@/components/store/layout/header/header'
import { Country } from '@/lib/types'
import { cookies } from 'next/headers'

export default function CartPage() {
    // Get cookies from the store
    const cookieStore = cookies()
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
        userCountry = JSON.parse(userCountryCookie.value) as Country
    }

    // Return the CartContainer component with the userCountry prop
    return (
        <>
            <StoreHeader />
            <CartContainer userCountry={userCountry} />
        </>
    )
}
