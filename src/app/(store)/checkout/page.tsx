import CheckoutContainer from '@/components/store/checkout-page/container'
import { db } from '@/lib/db'
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

    // Get list of countries
    const countries = await db.country.findMany({
        orderBy: { name: 'desc' },
    })

    return (
        <div className="min-h-screen bg-[#f4f4f4]">
            <div className="max-w-container mx-auto px-2 py-5">
                <CheckoutContainer cart={cart} countries={countries} />
            </div>
        </div>
    )
}
