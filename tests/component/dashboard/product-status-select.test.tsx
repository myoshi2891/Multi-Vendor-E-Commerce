/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ProductStatusSelect from '@/components/dashboard/forms/product-status-select'
import { ProductStatus } from '@/lib/types'
import { updateOrderItemStatus } from '@/queries/order'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

// Mock dependencies
jest.mock('@/queries/order', () => ({
    updateOrderItemStatus: jest.fn(),
}))
jest.mock('@/hooks/use-toast')
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

describe('ProductStatusSelect', () => {
    const mockToast = jest.fn()
    const mockRefresh = jest.fn()
    const storeId = 'store-1'
    const orderItemId = 'item-1'

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
        ;(useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh })
    })

    it('renders current status and toggles dropdown', () => {
        render(
            <ProductStatusSelect
                storeId={storeId}
                orderItemId={orderItemId}
                status={ProductStatus.Pending}
            />
        )

        expect(screen.getByText('Pending')).toBeInTheDocument()
        
        fireEvent.click(screen.getByText('Pending'))
        
        expect(screen.getByText('Shipped')).toBeInTheDocument()
    })

    it('successfully updates product status', async () => {
        ;(updateOrderItemStatus as jest.Mock).mockResolvedValue(ProductStatus.Shipped)

        render(
            <ProductStatusSelect
                storeId={storeId}
                orderItemId={orderItemId}
                status={ProductStatus.Pending}
            />
        )

        fireEvent.click(screen.getByText('Pending'))
        fireEvent.click(screen.getByText('Shipped'))

        await waitFor(() => {
            expect(updateOrderItemStatus).toHaveBeenCalledWith(storeId, orderItemId, ProductStatus.Shipped)
            expect(screen.getByText('Shipped')).toBeInTheDocument()
            expect(mockRefresh).toHaveBeenCalled()
        })
    })

    it('handles error during update', async () => {
        const errorMessage = 'Internal Server Error'
        ;(updateOrderItemStatus as jest.Mock).mockRejectedValue(new Error(errorMessage))

        render(
            <ProductStatusSelect
                storeId={storeId}
                orderItemId={orderItemId}
                status={ProductStatus.Pending}
            />
        )

        fireEvent.click(screen.getByText('Pending'))
        fireEvent.click(screen.getByText('Shipped'))

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                variant: 'destructive',
                title: 'Failed to update order status',
                description: expect.stringContaining(errorMessage),
            }))
        })
    })
})
