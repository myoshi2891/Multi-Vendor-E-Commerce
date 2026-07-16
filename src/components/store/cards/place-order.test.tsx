/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { ShippingAddress } from '@prisma/client'
import type { SerializedCartType } from '@/lib/types'

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

jest.mock('@/queries/user', () => ({
    emptyUserCart: jest.fn(),
    placeOrder: jest.fn(),
}))

jest.mock('@/cart-store/useCartStore', () => ({
    useCartStore: (selector: (state: { emptyCart: jest.Mock }) => unknown) =>
        selector({ emptyCart: jest.fn() }),
}))

jest.mock('react-hot-toast', () => ({
    __esModule: true,
    default: Object.assign(jest.fn(), { error: jest.fn() }),
}))

jest.mock('./fast-delivery', () => ({
    __esModule: true,
    default: () => <div />,
}))

jest.mock('../product-page/returns-security-privacy-card', () => ({
    SecurityPrivacyCard: () => <div />,
}))

jest.mock('../forms/apply-coupon', () => ({
    __esModule: true,
    default: () => <div />,
}))

jest.mock('react-spinners', () => ({
    PulseLoader: () => <span>Loading</span>,
}))

import { useRouter } from 'next/navigation'
import { placeOrder } from '@/queries/user'
import PlaceOrderCard from './place-order'

const mockedPlaceOrder = jest.mocked(placeOrder)
const push = jest.fn()

const cartData = {
    id: 'cart-001',
    subTotal: 10,
    shippingFees: 2,
    total: 12,
    coupon: null,
    cartItems: [],
} as unknown as SerializedCartType

const shippingAddress = { id: 'address-001' } as ShippingAddress

beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push })
})

describe('PlaceOrderCard', () => {
    it('submits only once when the button is clicked rapidly', async () => {
        const pendingOrder = new Promise<never>(() => {})
        mockedPlaceOrder.mockReturnValue(pendingOrder as never)

        render(
            <PlaceOrderCard
                shippingAddress={shippingAddress}
                cartData={cartData}
                setCartData={jest.fn()}
            />
        )
        const button = screen.getByRole('button', { name: 'Place order' })

        fireEvent.click(button)
        fireEvent.click(button)

        await waitFor(() => {
            expect(mockedPlaceOrder).toHaveBeenCalledTimes(1)
        })
        expect(button).toBeDisabled()
    })
})
