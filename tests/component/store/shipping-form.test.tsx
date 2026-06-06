/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import AddressDetails from '@/components/store/shared/shipping-addresses/address-details'
import { createMockShippingAddress, createMockCountry, createMockUser } from '@/config/test-fixtures'
import { upsertShippingAddress } from '@/queries/user'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

import { UserShippingAddressType } from '@/lib/types'
import { User, Role } from '@prisma/client'

// Mock dependencies
jest.mock('@/queries/user', () => ({
    addToWishlist: jest.fn(),
    placeOrder: jest.fn(),
    emptyUserCart: jest.fn(),
    upsertShippingAddress: jest.fn(),
}))
jest.mock('@/hooks/use-toast')
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))
jest.mock('uuid', () => ({
    v4: jest.fn(),
}))
// Mock CountrySelector to simplify testing
interface MockCountrySelectorProps {
    onChange: (value: string) => void
    selectedValue?: { name: string }
}
jest.mock('@/components/shared/country-selector', () => ({
    __esModule: true,
    default: ({ onChange, selectedValue }: MockCountrySelectorProps) => (
        <select 
            data-testid="country-selector" 
            value={selectedValue?.name} 
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="Japan">Japan</option>
            <option value="United States">United States</option>
        </select>
    )
}))

describe('AddressDetails', () => {
    const mockToast = jest.fn()
    const mockRefresh = jest.fn()
    const mockSetShow = jest.fn()
    const countries = [
        createMockCountry({ id: '550e8400-e29b-41d4-a716-446655440000', name: 'Japan', code: 'JP' }),
        createMockCountry({ id: '550e8400-e29b-41d4-a716-446655440001', name: 'United States', code: 'US' }),
    ]

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
        ;(useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh })
        ;(uuidv4 as jest.Mock).mockReturnValue('550e8400-e29b-41d4-a716-446655440002')
    })

    it('renders form fields for new address', () => {
        render(<AddressDetails countries={countries} setShow={mockSetShow} />)

        expect(screen.getByPlaceholderText('First name')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Last name')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Phone number')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Street, house/apartment/unit')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('City')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('State/Province')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Zip code')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Create Address/i })).toBeInTheDocument()
    })

    it('renders with existing data', () => {
        const address: UserShippingAddressType = {
            ...createMockShippingAddress({
                id: '550e8400-e29b-41d4-a716-446655440003',
                firstName: 'John',
                lastName: 'Doe',
                phone: '123456789',
                address1: 'Main St 1',
                city: 'Tokyo',
                state: 'Tokyo',
                zip_code: '100-0001',
                countryId: '550e8400-e29b-41d4-a716-446655440000',
            }),
            country: countries[0],
            user: { ...createMockUser(), role: Role.USER } as User
        }

        render(<AddressDetails data={address} countries={countries} setShow={mockSetShow} />)

        expect(screen.getByPlaceholderText('First name')).toHaveValue('John')
        expect(screen.getByPlaceholderText('Last name')).toHaveValue('Doe')
        expect(screen.getByRole('button', { name: /Save Address information/i })).toBeInTheDocument()
    })

    it('successfully creates a new address', async () => {
        const user = userEvent.setup()
        ;(upsertShippingAddress as jest.Mock).mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440002' })

        render(<AddressDetails countries={countries} setShow={mockSetShow} />)

        await user.type(screen.getByPlaceholderText('First name'), 'Jane')
        await user.type(screen.getByPlaceholderText('Last name'), 'Smith')
        await user.type(screen.getByPlaceholderText('Phone number'), '987654321')
        await user.type(screen.getByPlaceholderText('Street, house/apartment/unit'), 'Test Road 123')
        await user.type(screen.getByPlaceholderText('City'), 'New York')
        await user.type(screen.getByPlaceholderText('State/Province'), 'NY')
        await user.type(screen.getByPlaceholderText('Zip code'), '10001')

        // CountrySelector mock usage
        await user.selectOptions(screen.getByTestId('country-selector'), 'United States')

        await user.click(screen.getByRole('button', { name: /Create Address/i }))

        await waitFor(() => {
            expect(upsertShippingAddress).toHaveBeenCalledWith(expect.objectContaining({
                firstName: 'Jane',
                lastName: 'Smith',
                countryId: '550e8400-e29b-41d4-a716-446655440001',
                id: '550e8400-e29b-41d4-a716-446655440002'
            }))
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: expect.stringContaining('Congratulations'),
            }))
            expect(mockRefresh).toHaveBeenCalled()
            expect(mockSetShow).toHaveBeenCalledWith(false)
        })
    })

    it('shows validation errors for invalid inputs', async () => {
        const user = userEvent.setup()
        render(<AddressDetails countries={countries} setShow={mockSetShow} />)

        await user.click(screen.getByRole('button', { name: /Create Address/i }))

        await waitFor(() => {
            expect(screen.getByText(/First name must be at least 2 characters long/i)).toBeInTheDocument()
            expect(screen.getByText(/Last name must be at least 2 characters long/i)).toBeInTheDocument()
            expect(screen.getByText(/Invalid phone number format/i)).toBeInTheDocument()
        })
    })

    it('handles API errors correctly', async () => {
        const user = userEvent.setup()
        const errorMessage = 'Failed to save address'
        ;(upsertShippingAddress as jest.Mock).mockRejectedValue(new Error(errorMessage))

        render(<AddressDetails countries={countries} setShow={mockSetShow} />)

        // Fill required fields
        await user.type(screen.getByPlaceholderText('First name'), 'Jane')
        await user.type(screen.getByPlaceholderText('Last name'), 'Smith')
        await user.type(screen.getByPlaceholderText('Phone number'), '987654321')
        await user.type(screen.getByPlaceholderText('Street, house/apartment/unit'), 'Road 1')
        await user.type(screen.getByPlaceholderText('City'), 'City')
        await user.type(screen.getByPlaceholderText('State/Province'), 'State')
        await user.type(screen.getByPlaceholderText('Zip code'), '12345')
        
        // Select country
        await user.selectOptions(screen.getByTestId('country-selector'), 'Japan')

        await user.click(screen.getByRole('button', { name: /Create Address/i }))

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                variant: 'destructive',
                description: expect.stringContaining(errorMessage),
            }))
        })
    })
})
