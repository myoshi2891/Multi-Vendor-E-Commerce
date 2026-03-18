/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import PlaceOrderCard from '@/components/store/cards/place-order'
import { createMockCart, createMockCoupon, createMockShippingAddress, createMockCartItem } from '@/config/test-fixtures'
import { placeOrder, emptyUserCart } from '@/queries/user'
import { useCartStore } from '@/cart-store/useCartStore'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Prisma } from '@prisma/client'

// Mock dependencies
jest.mock('@/queries/user', () => ({
    placeOrder: jest.fn(),
    emptyUserCart: jest.fn(),
}))
jest.mock('@/cart-store/useCartStore')
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))
jest.mock('react-hot-toast')
jest.mock('@/components/store/forms/apply-coupon', () => ({
    __esModule: true,
    default: () => <div data-testid="apply-coupon-form">ApplyCouponForm</div>,
}))
jest.mock('@/components/store/cards/fast-delivery', () => ({
    __esModule: true,
    default: () => <div>FastDelivery</div>,
}))
jest.mock('@/components/store/product-page/returns-security-privacy-card', () => ({
    SecurityPrivacyCard: () => <div>SecurityPrivacyCard</div>,
}))

describe('PlaceOrderCard', () => {
    const mockPush = jest.fn()
    const mockEmptyCart = jest.fn()
    const mockSetCartData = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
        ;(useCartStore as unknown as jest.Mock).mockReturnValue(mockEmptyCart)
    })

    const cartItem = createMockCartItem({
        storeId: 'store-1',
        price: new Prisma.Decimal('10.00'),
        quantity: 2,
        shippingFee: new Prisma.Decimal('5.00'),
    })

    const cartData: React.ComponentProps<typeof PlaceOrderCard>['cartData'] = {
        ...createMockCart({
            id: 'cart-1',
            subTotal: new Prisma.Decimal('20.00'),
            shippingFees: new Prisma.Decimal('5.00'),
            total: new Prisma.Decimal('25.00'),
        }),
        cartItems: [cartItem],
        coupon: null,
    }

    it('renders summary correctly without coupon', () => {
        render(
            <PlaceOrderCard
                shippingAddress={null}
                cartData={cartData}
                setCartData={mockSetCartData}
            />
        )

        expect(screen.getByText('Summary')).toBeInTheDocument()
        expect(screen.getByText('Subtotal')).toBeInTheDocument()
        expect(screen.getByText('20.00')).toBeInTheDocument()
        expect(screen.getByText('Shipping Fees')).toBeInTheDocument()
        expect(screen.getByText('+5.00')).toBeInTheDocument()
        expect(screen.getByText('Total')).toBeInTheDocument()
        expect(screen.getByText('25.00')).toBeInTheDocument()
        expect(screen.getByTestId('apply-coupon-form')).toBeInTheDocument()
    })

    it('renders correctly with applied coupon', () => {
        const coupon = {
            ...createMockCoupon({
                code: 'SAVE10',
                discount: 10,
                storeId: 'store-1',
            }),
            store: { name: 'Test Store' }
        }
        const cartWithCoupon: React.ComponentProps<typeof PlaceOrderCard>['cartData'] = {
            ...cartData,
            coupon,
        }

        render(
            <PlaceOrderCard
                shippingAddress={null}
                cartData={cartWithCoupon}
                setCartData={mockSetCartData}
            />
        )

        expect(screen.getByText(/Coupon \(SAVE10\) \(-10%\)/)).toBeInTheDocument()
        // storeSubTotal = 10 * 2 + 5 = 25. 10% of 25 = 2.50
        expect(screen.getByText('-$2.50')).toBeInTheDocument()
        expect(screen.getByText('Coupon applied !')).toBeInTheDocument()
        expect(screen.getByText(/Test Store/)).toBeInTheDocument()
    })

    it('shows error if placing order without shipping address', async () => {
        render(
            <PlaceOrderCard
                shippingAddress={null}
                cartData={cartData}
                setCartData={mockSetCartData}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Place order/i }))

        expect(toast.error).toHaveBeenCalledWith('Select a shipping address before placing your order.')
        expect(placeOrder).not.toHaveBeenCalled()
    })

    it('successfully places an order', async () => {
        const address = createMockShippingAddress({ id: 'addr-1' })
        ;(placeOrder as jest.Mock).mockResolvedValue({ orderId: 'ord-123' })

        render(
            <PlaceOrderCard
                shippingAddress={address}
                cartData={cartData}
                setCartData={mockSetCartData}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Place order/i }))

        await waitFor(() => {
            expect(placeOrder).toHaveBeenCalledWith(address, 'cart-1')
            expect(mockEmptyCart).toHaveBeenCalled()
            expect(emptyUserCart).toHaveBeenCalled()
            expect(mockPush).toHaveBeenCalledWith('/order/ord-123')
        })
    })
})
