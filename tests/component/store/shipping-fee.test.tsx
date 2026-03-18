/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ProductShippingFee from '@/components/store/product-page/shipping/shipping-fee'
import { matchText } from '@/config/test-helpers'

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({}))

describe('ProductShippingFee', () => {
    describe('ITEM method', () => {
        it('renders correctly when fee equals extraFee', () => {
            render(<ProductShippingFee method="ITEM" fee={5} extraFee={5} weight={1} quantity={2} />)
            
            expect(screen.getByText(/calculates the delivery fee based on the number of items/)).toBeInTheDocument()
            expect(screen.queryByText(/receive a discounted delivery fee/)).not.toBeInTheDocument()
            expect(screen.getByText(/Fee per item/)).toBeInTheDocument()
            expect(screen.getByText(matchText('$5 (fee) x 2 (items) = $10'))).toBeInTheDocument()
        })

        it('renders correctly when fee does not equal extraFee', () => {
            render(<ProductShippingFee method="ITEM" fee={10} extraFee={5} weight={1} quantity={2} />)
            
            expect(screen.getByText(/receive a discounted delivery fee/)).toBeInTheDocument()
            expect(screen.getByText(/Fee for First Item/)).toBeInTheDocument()
            expect(screen.getByText(/Fee for Each Additional Item/)).toBeInTheDocument()
            expect(screen.getByText(matchText('$10 (first item) + 1 (additional items) x $5 = $15'))).toBeInTheDocument()
        })

        it('renders correctly for quantity 1 even if fee !== extraFee', () => {
            render(<ProductShippingFee method="ITEM" fee={10} extraFee={5} weight={1} quantity={1} />)
            
            // Formula should be simplified for qty 1
            expect(screen.getByText(matchText('$10 (fee) x 1 (items) = $10'))).toBeInTheDocument()
        })
    })

    describe('WEIGHT method', () => {
        it('renders correctly for weight-based shipping', () => {
            render(<ProductShippingFee method="WEIGHT" fee={2} extraFee={0} weight={1.5} quantity={3} />)
            
            expect(screen.getByText(/calculates the delivery fee bases on product weight/)).toBeInTheDocument()
            expect(screen.getByText(/Fee per kg/)).toBeInTheDocument()
            expect(screen.getByText(matchText('$2 (fee) x 1.5kg (weight) x 3 (items) = $9 (total fee)'))).toBeInTheDocument()
        })
    })

    describe('FIXED method', () => {
        it('renders correctly for fixed shipping', () => {
            render(<ProductShippingFee method="FIXED" fee={15} extraFee={0} weight={1} quantity={5} />)
            
            expect(screen.getByText(/calculates the delivery fee on a fixed price/)).toBeInTheDocument()
            expect(screen.getByText(/Fee/)).toBeInTheDocument()
            expect(screen.getByText(matchText('$15 (quantity doesn\'t affect shipping fee.)'))).toBeInTheDocument()
        })
    })

    describe('Edge cases', () => {
        it('returns null for unknown method', () => {
            const { container } = render(<ProductShippingFee method="UNKNOWN" fee={0} extraFee={0} weight={0} quantity={0} />)
            expect(container).toBeEmptyDOMElement()
        })
    })
})
