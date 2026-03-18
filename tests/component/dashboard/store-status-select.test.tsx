/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import StoreStatusSelect from '@/components/dashboard/forms/store-status-select'
import { StoreStatus } from '@/lib/types'
import { updateStoreStatus } from '@/queries/store'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

// Mock dependencies
jest.mock('@/queries/store', () => ({
    updateStoreStatus: jest.fn(),
}))
jest.mock('@/hooks/use-toast')
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

describe('StoreStatusSelect', () => {
    const mockToast = jest.fn()
    const mockRefresh = jest.fn()
    const storeId = 'store-1'

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
        ;(useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh })
    })

    it('renders current status and toggles dropdown', () => {
        render(
            <StoreStatusSelect
                storeId={storeId}
                status={StoreStatus.PENDING}
            />
        )

        expect(screen.getByText('Pending')).toBeInTheDocument()
        
        fireEvent.click(screen.getByText('Pending'))
        
        expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('successfully updates store status', async () => {
        ;(updateStoreStatus as jest.Mock).mockResolvedValue(StoreStatus.ACTIVE)

        render(
            <StoreStatusSelect
                storeId={storeId}
                status={StoreStatus.PENDING}
            />
        )

        fireEvent.click(screen.getByText('Pending'))
        fireEvent.click(screen.getByText('Active'))

        await waitFor(() => {
            expect(updateStoreStatus).toHaveBeenCalledWith(storeId, StoreStatus.ACTIVE)
            expect(screen.getByText('Active')).toBeInTheDocument()
        })
    })

    it('handles error during update', async () => {
        const errorMessage = 'Bad Request'
        ;(updateStoreStatus as jest.Mock).mockRejectedValue(new Error(errorMessage))

        render(
            <StoreStatusSelect
                storeId={storeId}
                status={StoreStatus.PENDING}
            />
        )

        fireEvent.click(screen.getByText('Pending'))
        fireEvent.click(screen.getByText('Active'))

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                variant: 'destructive',
                title: 'Failed to update order status',
                description: expect.stringContaining(errorMessage),
            }))
        })
    })
})
