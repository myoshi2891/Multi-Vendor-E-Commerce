/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import AddressDetails from '@/components/store/shared/shipping-addresses/address-details'
import { createMockShippingAddress, createMockCountry } from '@/config/test-fixtures'
import { upsertShippingAddress } from '@/queries/user'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

// Mock dependencies
jest.mock('@/queries/user', () => ({
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
jest.mock('@/components/shared/country-selector', () => ({
    __esModule: true,
    default: ({ onChange, selectedValue }: any) => (
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
        const address = {
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
            country: countries[0]
        }

        render(<AddressDetails data={address as any} countries={countries} setShow={mockSetShow} />)

        expect(screen.getByPlaceholderText('First name')).toHaveValue('John')
        expect(screen.getByPlaceholderText('Last name')).toHaveValue('Doe')
        expect(screen.getByRole('button', { name: /Save Address information/i })).toBeInTheDocument()
    })

    it('successfully creates a new address', async () => {
        ;(upsertShippingAddress as jest.Mock).mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440002' })

        render(<AddressDetails countries={countries} setShow={mockSetShow} />)

        fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Jane' } })
        fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Smith' } })
        fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '987654321' } })
        fireEvent.change(screen.getByPlaceholderText('Street, house/apartment/unit'), { target: { value: 'Test Road 123' } })
        fireEvent.change(screen.getByPlaceholderText('City'), { target: { value: 'New York' } })
        fireEvent.change(screen.getByPlaceholderText('State/Province'), { target: { value: 'NY' } })
        fireEvent.change(screen.getByPlaceholderText('Zip code'), { target: { value: '10001' } })
        
        // CountrySelector mock usage
        fireEvent.change(screen.getByTestId('country-selector'), { target: { value: 'United States' } })

        fireEvent.click(screen.getByRole('button', { name: /Create Address/i }))

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
        render(<AddressDetails countries={countries} setShow={mockSetShow} />)

        fireEvent.click(screen.getByRole('button', { name: /Create Address/i }))

        await waitFor(() => {
            expect(screen.getByText(/First name must be at least 2 characters long/i)).toBeInTheDocument()
            expect(screen.getByText(/Last name must be at least 2 characters long/i)).toBeInTheDocument()
            expect(screen.getByText(/Invalid phone number format/i)).toBeInTheDocument()
        })
    })

    it('handles API errors correctly', async () => {
        const errorMessage = 'Failed to save address'
        ;(upsertShippingAddress as jest.Mock).mockRejectedValue(new Error(errorMessage))

        render(<AddressDetails countries={countries} setShow={mockSetShow} />)

        // Fill required fields
        fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Jane' } })
        fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Smith' } })
        fireEvent.change(screen.getByPlaceholderText('Phone number'), { target: { value: '987654321' } })
        fireEvent.change(screen.getByPlaceholderText('Street, house/apartment/unit'), { target: { value: 'Road 1' } })
        fireEvent.change(screen.getByPlaceholderText('City'), { target: { value: 'City' } })
        fireEvent.change(screen.getByPlaceholderText('State/Province'), { target: { value: 'State' } })
        fireEvent.change(screen.getByPlaceholderText('Zip code'), { target: { value: '12345' } })
        
        // Select country
        fireEvent.change(screen.getByTestId('country-selector'), { target: { value: 'Japan' } })

        fireEvent.click(screen.getByRole('button', { name: /Create Address/i }))

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                variant: 'destructive',
                description: expect.stringContaining(errorMessage),
            }))
        })
    })
})
