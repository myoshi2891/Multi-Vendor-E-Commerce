/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import OrderStatusTag from '@/components/shared/order-status'
import PaymentStatusTag from '@/components/shared/payment-status'
import ProductStatusTag from '@/components/shared/product-status'
import StoreStatusTag from '@/components/shared/store-status'
import { OrderStatus, PaymentStatus, ProductStatus, StoreStatus } from '@/lib/types'

describe('Status Tags', () => {
    describe('OrderStatusTag', () => {
        const statuses = Object.values(OrderStatus)
        
        const statusLabels: Record<OrderStatus, string> = {
            [OrderStatus.Pending]: "Pending",
            [OrderStatus.Confirmed]: "Confirmed",
            [OrderStatus.Processing]: "Processing",
            [OrderStatus.Shipped]: "Shipped",
            [OrderStatus.OutForDelivery]: "Out for Delivery",
            [OrderStatus.Delivered]: "Delivered",
            [OrderStatus.Canceled]: "Canceled",
            [OrderStatus.Failed]: "Failed",
            [OrderStatus.Returned]: "Returned",
            [OrderStatus.Refunded]: "Refunded",
            [OrderStatus.PartiallyShipped]: "Partially Shipped",
            [OrderStatus.OnHold]: "On Hold",
        }

        it.each(statuses)('renders correctly for status: %s', (status) => {
            render(<OrderStatusTag status={status} />)
            
            expect(screen.getByText(statusLabels[status])).toBeInTheDocument()
            
            const tag = screen.getByText(statusLabels[status]).closest('span')
            expect(tag).toHaveClass('inline-flex', 'items-center')
        })
    })

    describe('PaymentStatusTag', () => {
        const statuses = Object.values(PaymentStatus)

        it.each(statuses)('renders correctly for status: %s', (status) => {
            const { rerender } = render(<PaymentStatusTag status={status} isTable={true} />)
            
            expect(screen.getByText(status)).toBeInTheDocument()

            // Special case for Pending when not in table
            if (status === PaymentStatus.Pending) {
                rerender(<PaymentStatusTag status={status} isTable={false} />)
                expect(screen.getByText('Pending (Waiting for payment)')).toBeInTheDocument()
            }
        })
    })

    describe('ProductStatusTag', () => {
        const statuses = Object.values(ProductStatus)
        
        // ProductStatusTag uses styles.label which might differ from enum value string
        const statusLabels: Record<ProductStatus, string> = {
            [ProductStatus.Pending]: "Pending",
            [ProductStatus.Processing]: "Processing",
            [ProductStatus.ReadyForShipment]: "Ready for Shipment",
            [ProductStatus.Shipped]: "Shipped",
            [ProductStatus.Delivered]: "Delivered",
            [ProductStatus.Canceled]: "Canceled",
            [ProductStatus.Returned]: "Returned",
            [ProductStatus.Refunded]: "Refunded",
            [ProductStatus.FailedDelivery]: "Failed Delivery",
            [ProductStatus.OnHold]: "On Hold",
            [ProductStatus.BackOrdered]: "Backordered",
            [ProductStatus.PartiallyShipped]: "Partially Shipped",
            [ProductStatus.ExchangeRequested]: "Exchange Requested",
            [ProductStatus.AwaitingPickup]: "Awaiting Pickup",
        }

        it.each(statuses)('renders correctly for status: %s', (status) => {
            render(<ProductStatusTag status={status} />)
            expect(screen.getByText(statusLabels[status])).toBeInTheDocument()
        })
    })

    describe('StoreStatusTag', () => {
        const statuses = Object.values(StoreStatus)
        
        const statusLabels: Record<StoreStatus, string> = {
            [StoreStatus.PENDING]: "Pending",
            [StoreStatus.ACTIVE]: "Active",
            [StoreStatus.BANNED]: "Banned",
            [StoreStatus.DISABLED]: "Disabled",
        }

        it.each(statuses)('renders correctly for status: %s', (status) => {
            render(<StoreStatusTag status={status} />)
            expect(screen.getByText(statusLabels[status])).toBeInTheDocument()
        })
    })
})

// Purchase variant is opt-in: every existing state retains a readable label.
describe('store status presentation', () => {
    it.each(Object.values(OrderStatus))('order %s opts in without losing its label', status => {
        const { container } = render(<OrderStatusTag status={status} {...{ variant: 'store' as const }} />);
        const tag = container.querySelector('span')!;
        expect(tag).toHaveAttribute('data-appearance', 'store');
        expect(tag).toHaveAttribute('data-status', status);
        expect(tag.textContent?.trim()).not.toBe('');
    });
    it.each(Object.values(PaymentStatus))('payment %s opts in without losing its label', status => {
        const { container } = render(<PaymentStatusTag status={status} {...{ variant: 'store' as const }} />);
        expect(container.querySelector('span')).toHaveAttribute('data-appearance', 'store');
        expect(container.querySelector('span')).toHaveAttribute('data-status', status);
        expect(container.textContent).toContain(status);
    });
    it.each(Object.values(ProductStatus))('item %s opts in without losing its label', status => {
        const { container } = render(<ProductStatusTag status={status} {...{ variant: 'store' as const }} />);
        expect(container.querySelector('span')).toHaveAttribute('data-appearance', 'store');
        expect(container.querySelector('span')).toHaveAttribute('data-status', status);
        expect(container.textContent?.trim()).not.toBe('');
    });
});
