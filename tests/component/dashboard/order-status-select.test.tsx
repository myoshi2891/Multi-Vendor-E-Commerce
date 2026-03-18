/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import OrderStatusSelect from '@/components/dashboard/forms/order-status-select'
import { OrderStatus } from '@/lib/types'
import { updateOrderGroupStatus } from '@/queries/order'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

// Mock dependencies
jest.mock('@/queries/order', () => ({
    updateOrderGroupStatus: jest.fn(),
}))
jest.mock('@/hooks/use-toast')
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

describe('OrderStatusSelect', () => {
    const mockToast = jest.fn()
    const mockRefresh = jest.fn()
    const storeId = 'store-1'
    const groupId = 'group-1'

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
        ;(useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh })
    })

    it('renders current status and toggles dropdown', () => {
        render(
            <OrderStatusSelect
                storeId={storeId}
                groupId={groupId}
                status={OrderStatus.Pending}
            />
        )

        // Current status (OrderStatusTag renders label)
        expect(screen.getByText('Pending')).toBeInTheDocument()
        
        // Dropdown should be closed initially
        expect(screen.queryByRole('button')).not.toBeInTheDocument()

        // Toggle dropdown
        fireEvent.click(screen.getByText('Pending'))
        
        // Other statuses should be visible (e.g. Shipped)
        expect(screen.getByText('Shipped')).toBeInTheDocument()
    })

    it('successfully updates order status', async () => {
        ;(updateOrderGroupStatus as jest.Mock).mockResolvedValue(OrderStatus.Shipped)

        render(
            <OrderStatusSelect
                storeId={storeId}
                groupId={groupId}
                status={OrderStatus.Pending}
            />
        )

        fireEvent.click(screen.getByText('Pending'))
        fireEvent.click(screen.getByText('Shipped'))

        await waitFor(() => {
            expect(updateOrderGroupStatus).toHaveBeenCalledWith(storeId, groupId, OrderStatus.Shipped)
            expect(screen.getByText('Shipped')).toBeInTheDocument()
            expect(screen.queryByText('Pending')).not.toBeInTheDocument()
        })
    })

    it('handles error during update', async () => {
        const errorMessage = 'Unauthorized'
        ;(updateOrderGroupStatus as jest.Mock).mockRejectedValue(new Error(errorMessage))

        render(
            <OrderStatusSelect
                storeId={storeId}
                groupId={groupId}
                status={OrderStatus.Pending}
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
