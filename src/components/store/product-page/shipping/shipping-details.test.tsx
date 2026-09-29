/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { ShippingFeeMethod } from '@prisma/client'
import ShippingDetails from './shipping-details'

const shippingDetails = {
    shippingFeeMethod: ShippingFeeMethod.FIXED,
    shippingService: 'Artisan Delivery',
    shippingFee: 15,
    extraShippingFee: 0,
    deliveryTimeMin: 3,
    deliveryTimeMax: 7,
    isFreeShipping: false,
    returnPolicy: 'Return within 14 days',
    countryCode: 'JP',
    countryName: 'Japan',
    city: 'Tokyo',
}

describe('ShippingDetails', () => {
    it('shows a full-width disclosure and toggles an accessible fee breakdown', () => {
        render(<ShippingDetails shippingDetails={shippingDetails} quantity={2} weight={1} />)

        const button = screen.getByRole('button', { name: 'Show shipping fee breakdown' })
        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(button).toHaveAttribute('data-testid', 'shipping-breakdown-toggle')
        expect(screen.queryByRole('region', { name: 'Shipping fee breakdown' })).not.toBeInTheDocument()

        fireEvent.click(button)
        expect(screen.getByRole('button', { name: 'Hide shipping fee breakdown' })).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('region', { name: 'Shipping fee breakdown' })).toHaveTextContent('$15')
        expect(screen.getByText('Total delivery')).toBeInTheDocument()
    })

    it('does not show a fee disclosure for free shipping', () => {
        render(<ShippingDetails shippingDetails={{ ...shippingDetails, isFreeShipping: true }} quantity={1} weight={1} />)
        expect(screen.queryByTestId('shipping-breakdown-toggle')).not.toBeInTheDocument()
    })
})
