/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ApplyCouponForm from '@/components/store/forms/apply-coupon'
import { applyCoupon } from '@/queries/coupon'
import toast from 'react-hot-toast'

// Mock dependencies
jest.mock('@/queries/coupon', () => ({
    applyCoupon: jest.fn(),
}))
jest.mock('react-hot-toast', () => ({
    __esModule: true,
    default: {
        success: jest.fn(),
        error: jest.fn(),
    }
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: jest.fn(),
    }),
}))

describe('ApplyCouponForm', () => {
    const mockSetCartData = jest.fn()
    const cartId = 'cart-123'

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders input and apply button', () => {
        render(<ApplyCouponForm cartId={cartId} setCartData={mockSetCartData} />)

        expect(screen.getByPlaceholderText('Coupon code')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument()
    })

    it('successfully applies a coupon', async () => {
        const mockCart = { id: cartId, total: 90, cartItems: [] }
        const mockRes = { cart: mockCart, message: 'Coupon applied!' }
        ;(applyCoupon as jest.Mock).mockResolvedValue(mockRes)

        render(<ApplyCouponForm cartId={cartId} setCartData={mockSetCartData} />)

        const input = screen.getByPlaceholderText('Coupon code')
        fireEvent.change(input, { target: { value: 'SAVE10' } })
        fireEvent.click(screen.getByRole('button', { name: /apply/i }))

        await waitFor(() => {
            expect(applyCoupon).toHaveBeenCalledWith('SAVE10', cartId)
            expect(mockSetCartData).toHaveBeenCalledWith(mockCart)
            expect(toast.success).toHaveBeenCalledWith('Coupon applied!')
        })
    })

    it('shows validation error for empty coupon code', async () => {
        render(<ApplyCouponForm cartId={cartId} setCartData={mockSetCartData} />)

        fireEvent.click(screen.getByRole('button', { name: /apply/i }))

        await waitFor(() => {
            expect(screen.getByText(/Coupon code must be at least 2 characters long/i)).toBeInTheDocument()
        })
    })

    it('handles API error correctly', async () => {
        const errorMessage = 'Invalid coupon code'
        ;(applyCoupon as jest.Mock).mockRejectedValue(new Error(errorMessage))

        render(<ApplyCouponForm cartId={cartId} setCartData={mockSetCartData} />)

        const input = screen.getByPlaceholderText('Coupon code')
        fireEvent.change(input, { target: { value: 'INVALID' } })
        fireEvent.click(screen.getByRole('button', { name: /apply/i }))

        await waitFor(() => {
            expect(applyCoupon).toHaveBeenCalledWith('INVALID', cartId)
            expect(toast.error).toHaveBeenCalledWith(expect.stringContaining(errorMessage))
        })
    })
})
