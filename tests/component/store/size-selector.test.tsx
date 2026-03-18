/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import SizeSelector from '@/components/store/product-page/product-info/size.selector'
import { createMockSize } from '@/config/test-fixtures'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
    usePathname: jest.fn(),
    useSearchParams: jest.fn(),
}))

describe('SizeSelector', () => {
    const mockReplace = jest.fn()
    const mockPathname = '/product/test'
    const mockHandleChange = jest.fn()
    const mockSearchParams = new URLSearchParams()

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useRouter as jest.Mock).mockReturnValue({ replace: mockReplace })
        ;(usePathname as jest.Mock).mockReturnValue(mockPathname)
        ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)
    })

    const sizes = [
        createMockSize({ id: 's1', size: 'S' }),
        createMockSize({ id: 's2', size: 'M' }),
        createMockSize({ id: 's3', size: 'L' }),
    ]

    it('renders all sizes', () => {
        render(<SizeSelector sizes={sizes} sizeId={undefined} handleChange={mockHandleChange} />)

        expect(screen.getByText('S')).toBeInTheDocument()
        expect(screen.getByText('M')).toBeInTheDocument()
        expect(screen.getByText('L')).toBeInTheDocument()
    })

    it('highlights the selected size', () => {
        render(<SizeSelector sizes={sizes} sizeId="s2" handleChange={mockHandleChange} />)

        const selectedOption = screen.getByTestId('size-option-s2')
        expect(selectedOption).toHaveStyle({ borderColor: '#000' })

        const unselectedOption = screen.getByTestId('size-option-s1')
        expect(unselectedOption).toHaveStyle({ borderColor: '' })
    })

    it('calls handleChange and router.replace on size click', () => {
        render(<SizeSelector sizes={sizes} sizeId={undefined} handleChange={mockHandleChange} />)

        fireEvent.click(screen.getByText('M'))

        expect(mockHandleChange).toHaveBeenCalledWith('sizeId', 's2')
        expect(mockHandleChange).toHaveBeenCalledWith('size', 'M')
        expect(mockReplace).toHaveBeenCalledWith(`${mockPathname}?size=s2`)
    })

    it('syncs initial sizeId with handleChange on mount', () => {
        render(<SizeSelector sizes={sizes} sizeId="s1" handleChange={mockHandleChange} />)

        expect(mockHandleChange).toHaveBeenCalledWith('sizeId', 's1')
        expect(mockHandleChange).toHaveBeenCalledWith('size', 'S')
    })

    it('does not call handleChange if sizeId is provided but not found in sizes', () => {
        render(<SizeSelector sizes={sizes} sizeId="non-existent" handleChange={mockHandleChange} />)

        expect(mockHandleChange).not.toHaveBeenCalled()
    })

    it('updates URL with multiple search params', () => {
        const existingParams = new URLSearchParams('color=red')
        ;(useSearchParams as jest.Mock).mockReturnValue(existingParams)

        render(<SizeSelector sizes={sizes} sizeId={undefined} handleChange={mockHandleChange} />)

        fireEvent.click(screen.getByText('L'))

        expect(mockReplace).toHaveBeenCalledWith(`${mockPathname}?color=red&size=s3`)
    })
})
