/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ProductPrice from '@/components/store/product-page/product-info/product-price'
import { createMockSize } from '@/config/test-fixtures'
import { Prisma } from '@prisma/client'

describe('ProductPrice', () => {
    const mockHandleChange = jest.fn()

    beforeEach(() => {
        mockHandleChange.mockClear()
    })

    describe('No sizeId passed — Price range display', () => {
        it('renders price range for multiple sizes with different prices', () => {
            const sizes = [
                createMockSize({ id: 's1', price: 10, discount: 0 }),
                createMockSize({ id: 's2', price: 20, discount: 0 }),
            ]
            render(<ProductPrice sizes={sizes} handleChange={mockHandleChange} />)

            expect(screen.getByTestId('product-price')).toHaveTextContent('$10.00 - $20.00')
            expect(screen.getByText(/Select a size to see the exact price/)).toBeInTheDocument()
            expect(screen.getByText(/100 pieces/)).toBeInTheDocument() // 50 + 50 from default mock
        })

        it('renders single price if all sizes have the same discounted price', () => {
            const sizes = [
                createMockSize({ id: 's1', price: 10, discount: 0 }),
                createMockSize({ id: 's2', price: 10, discount: 0 }),
            ]
            render(<ProductPrice sizes={sizes} handleChange={mockHandleChange} />)

            expect(screen.getByTestId('product-price')).toHaveTextContent('$10.00')
        })

        it('calculates range correctly with discounts', () => {
            const sizes = [
                createMockSize({ id: 's1', price: 100, discount: 10 }), // 90.00
                createMockSize({ id: 's2', price: 200, discount: 50 }), // 100.00
            ]
            render(<ProductPrice sizes={sizes} handleChange={mockHandleChange} />)

            expect(screen.getByTestId('product-price')).toHaveTextContent('$90.00 - $100.00')
        })

        it('uses smaller text size when isCard is true', () => {
            const sizes = [createMockSize({ price: 10 })]
            render(<ProductPrice sizes={sizes} isCard={true} handleChange={mockHandleChange} />)

            const priceSpan = screen.getByTestId('product-card-price')
            expect(priceSpan).toHaveClass('text-lg')
        })

        it('returns null if sizes array is empty', () => {
            const { container } = render(<ProductPrice sizes={[]} handleChange={mockHandleChange} />)
            expect(container).toBeEmptyDOMElement()
        })
    })

    describe('sizeId passed — Specific size price display', () => {
        it('renders discounted price and calls handleChange', () => {
            const sizes = [
                createMockSize({ id: 's1', price: 100, discount: 20, quantity: 10 }),
            ]
            render(<ProductPrice sizeId="s1" sizes={sizes} handleChange={mockHandleChange} />)

            expect(screen.getByTestId('product-price')).toHaveTextContent('$80.00')
            expect(screen.getByText('$100.00')).toHaveClass('line-through')
            expect(screen.getByText('20% off')).toBeInTheDocument()
            expect(screen.getByText('10 items')).toBeInTheDocument()

            expect(mockHandleChange).toHaveBeenCalledTimes(2)
            expect(mockHandleChange).toHaveBeenNthCalledWith(1, 'price', 80)
            expect(mockHandleChange).toHaveBeenNthCalledWith(2, 'stock', 10)
        })

        it('renders "Out of stock" if quantity is 0', () => {
            const sizes = [
                createMockSize({ id: 's1', price: 100, quantity: 0 }),
            ]
            render(<ProductPrice sizeId="s1" sizes={sizes} handleChange={mockHandleChange} />)

            expect(screen.getByText('Out of stock')).toBeInTheDocument()
            expect(screen.getByText('Out of stock')).toHaveClass('text-red-500')
        })

        it('returns empty fragment if sizeId is not found', () => {
            const sizes = [createMockSize({ id: 's1' })]
            const { container } = render(<ProductPrice sizeId="non-existent" sizes={sizes} handleChange={mockHandleChange} />)
            expect(container).toBeEmptyDOMElement()
        })
    })
})
