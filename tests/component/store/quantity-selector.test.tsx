/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import QuantitySelector from '@/components/store/product-page/quantity-selector'
import { createMockCartProduct, createMockSize } from '@/config/test-fixtures'
import useFromStore from '@/hooks/useFromStore'

// Mock hooks
jest.mock('@/hooks/useFromStore')
jest.mock('@/cart-store/useCartStore')

describe('QuantitySelector', () => {
    const mockHandleChange = jest.fn()
    const productId = 'p1'
    const variantId = 'v1'
    const sizeId = 's1'
    const stock = 10
    const sizes = [createMockSize({ id: 's1' })]

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useFromStore as jest.Mock).mockReturnValue([]) // Empty cart by default
    })

    it('renders skeleton if sizeId is not provided', () => {
        const { container } = render(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId={null}
                quantity={1}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={sizes}
            />
        )

        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
        expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('renders correctly when sizeId is provided', () => {
        render(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId={sizeId}
                quantity={1}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={sizes}
            />
        )

        expect(screen.getByText('Select quantity')).toBeInTheDocument()
        expect(screen.getByRole('spinbutton')).toHaveValue(1)
    })

    it('calls handleIncrease and handleDecrease', () => {
        render(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId={sizeId}
                quantity={2}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={sizes}
            />
        )

        const plusButton = screen.getAllByRole('button')[1]
        const minusButton = screen.getAllByRole('button')[0]

        fireEvent.click(plusButton)
        expect(mockHandleChange).toHaveBeenCalledWith('quantity', 3)

        fireEvent.click(minusButton)
        expect(mockHandleChange).toHaveBeenCalledWith('quantity', 1)
    })

    it('disables decrease button when quantity is 1', () => {
        render(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId={sizeId}
                quantity={1}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={sizes}
            />
        )

        const minusButton = screen.getAllByRole('button')[0]
        expect(minusButton).toBeDisabled()
    })

    it('disables increase button when quantity reached maxQty (stock)', () => {
        render(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId={sizeId}
                quantity={10}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={sizes}
            />
        )

        const plusButton = screen.getAllByRole('button')[1]
        expect(plusButton).toBeDisabled()
    })

    it('calculates maxQty correctly when item is already in cart', () => {
        const cartItem = createMockCartProduct({
            productId,
            variantId,
            sizeId,
            quantity: 3,
            stock: 10,
        })
        ;(useFromStore as jest.Mock).mockReturnValue([cartItem])

        render(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId={sizeId}
                quantity={1}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={sizes}
            />
        )

        // maxQty should be 10 - 3 = 7
        expect(screen.getByText(/You already have 3 pieces/)).toBeInTheDocument()
        
        const plusButton = screen.getAllByRole('button')[1]
        
        // Let's test with quantity at maxQty
        render(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId={sizeId}
                quantity={7}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={sizes}
            />
        )
        // Note: The above render will append to body, but we can query again
        const plusButtons = screen.getAllByRole('button')
        expect(plusButtons[3]).toBeDisabled() // Second render's plus button
    })

    it('resets quantity to 1 when sizeId changes', () => {
        const { rerender } = render(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId="s1"
                quantity={5}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={sizes}
            />
        )

        rerender(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId="s2"
                quantity={5}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={[...sizes, createMockSize({ id: 's2' })]}
            />
        )

        expect(mockHandleChange).toHaveBeenCalledWith('quantity', 1)
    })

    it('sets quantity to 0 if maxQty is 0', () => {
        const cartItem = createMockCartProduct({
            productId,
            variantId,
            sizeId,
            quantity: 10,
            stock: 10,
        })
        ;(useFromStore as jest.Mock).mockReturnValue([cartItem])

        render(
            <QuantitySelector
                productId={productId}
                variantId={variantId}
                sizeId={sizeId}
                quantity={1}
                stock={stock}
                handleChange={mockHandleChange}
                sizes={sizes}
            />
        )

        expect(screen.getByRole('spinbutton')).toHaveValue(0)
    })
})
