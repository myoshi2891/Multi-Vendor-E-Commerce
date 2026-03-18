/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import CartProduct from '@/components/store/cards/cart-product'
import { createMockCartProduct } from '@/config/test-fixtures'
import { useCartStore } from '@/cart-store/useCartStore'
import { addToWishlist } from '@/queries/user'
import toast from 'react-hot-toast'
import { ImageProps } from 'next/image'
import { matchTextCrunch as matchText } from '@/config/test-helpers'

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({}))
jest.mock('@/cart-store/useCartStore')
jest.mock('@/queries/user', () => ({
    addToWishlist: jest.fn(),
}))
jest.mock('react-hot-toast')
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt, width, height, className, style }: ImageProps) => {
        let imgSrc = ''
        if (typeof src === 'string') {
            imgSrc = src
        } else if (src && typeof src === 'object' && 'src' in src && typeof src.src === 'string') {
            imgSrc = src.src
        }

        return (
            <img 
                src={imgSrc} 
                alt={alt} 
                width={width} 
                height={height} 
                className={className} 
                style={style} 
            />
        )
    },
}))
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a>,
}))

describe('CartProduct', () => {
    const mockUpdateProductQuantity = jest.fn()
    const mockRemoveFromCart = jest.fn()
    const mockSetSelectedItems = jest.fn()
    const mockSetTotalShipping = jest.fn()
    const userCountry = { name: 'United States', code: 'US', city: 'New York', region: 'NY' }

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useCartStore as unknown as jest.Mock).mockReturnValue({
            updateProductQuantity: mockUpdateProductQuantity,
            removeFromCart: mockRemoveFromCart,
        })
    })

    const product = createMockCartProduct({
        productId: 'p1',
        variantId: 'v1',
        sizeId: 's1',
        name: 'Test Product',
        variantName: 'Red',
        price: 10,
        quantity: 2,
        stock: 10,
        shippingMethod: 'ITEM',
        shippingFee: 5,
        extraShippingFee: 2,
    })

    it('renders product details correctly', () => {
        render(
            <CartProduct
                product={product}
                selectedItems={[]}
                setSelectedItems={mockSetSelectedItems}
                setTotalShipping={mockSetTotalShipping}
                userCountry={userCountry}
            />
        )

        expect(screen.getByText(/Test Product ・ Red/)).toBeInTheDocument()
        expect(screen.getByText(/\$10.00 x 2 = \$20.00/)).toBeInTheDocument()
        expect(screen.getByText('M')).toBeInTheDocument() // size
    })

    describe('Shipping Fee Calculation', () => {
        it('calculates ITEM shipping fee correctly', () => {
            render(
                <CartProduct
                    product={product}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            // 5 + (2-1)*2 = 7
            expect(screen.getByText(matchText('$ 5 (first item) + 1 item x $2 (1 additional item) = $ 7.00'))).toBeInTheDocument()
            expect(mockSetTotalShipping).toHaveBeenCalled()
        })

        it('calculates WEIGHT shipping fee correctly', () => {
            const weightProduct = createMockCartProduct({
                ...product,
                shippingMethod: 'WEIGHT',
                shippingFee: 2,
                weight: 1.5,
                quantity: 2,
            })
            render(
                <CartProduct
                    product={weightProduct}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            // 2 * 1.5 * 2 = 6
            expect(screen.getByText(matchText('$2 x 1.5kg x 2 items = $ 6.00'))).toBeInTheDocument()
        })

        it('calculates FIXED shipping fee correctly', () => {
            const fixedProduct = createMockCartProduct({
                ...product,
                shippingMethod: 'FIXED',
                shippingFee: 15,
            })
            render(
                <CartProduct
                    product={fixedProduct}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            expect(screen.getByText(matchText('Fixed Fee : $ 15.00'))).toBeInTheDocument()
        })

        it('renders Free Delivery when totalFee is 0', () => {
            const freeProduct = createMockCartProduct({
                ...product,
                shippingFee: 0,
                extraShippingFee: 0,
            })
            render(
                <CartProduct
                    product={freeProduct}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            expect(screen.getByText('Free Delivery')).toBeInTheDocument()
        })
    })

    describe('Interactions', () => {
        it('calls updateProductQuantity on increase click', () => {
            render(
                <CartProduct
                    product={product}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            fireEvent.click(screen.getByTestId('cart-qty-increase'))
            expect(mockUpdateProductQuantity).toHaveBeenCalledWith(product, 3)
        })

        it('calls updateProductQuantity on decrease click when qty > 1', () => {
            render(
                <CartProduct
                    product={product}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            fireEvent.click(screen.getByTestId('cart-qty-decrease'))
            expect(mockUpdateProductQuantity).toHaveBeenCalledWith(product, 1)
        })

        it('calls removeFromCart on decrease click when qty is 1', () => {
            const singleQtyProduct = createMockCartProduct({ ...product, quantity: 1 })
            render(
                <CartProduct
                    product={singleQtyProduct}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            fireEvent.click(screen.getByTestId('cart-qty-decrease'))
            expect(mockRemoveFromCart).toHaveBeenCalledWith(singleQtyProduct)
        })

        it('calls setSelectedItems on checkbox click', () => {
            render(
                <CartProduct
                    product={product}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            fireEvent.click(screen.getByRole('checkbox', { hidden: true }))
            expect(mockSetSelectedItems).toHaveBeenCalled()
        })

        it('calls addToWishlist on heart click', async () => {
            ;(addToWishlist as jest.Mock).mockResolvedValue(true)
            render(
                <CartProduct
                    product={product}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            const heartIcon = screen.getByTestId('cart-item-p1-v1-s1').querySelector('.lucide-heart')?.closest('span')
            expect(heartIcon).not.toBeNull()
            fireEvent.click(heartIcon!)

            await waitFor(() => {
                expect(addToWishlist).toHaveBeenCalledWith('p1', 'v1', 's1')
                expect(toast.success).toHaveBeenCalledWith('Product successfully added to wishlist')
            })
        })
    })

    describe('Stock status', () => {
        it('renders "Out of stock" and disables selection when stock is 0', () => {
            const outOfStockProduct = createMockCartProduct({ ...product, stock: 0 })
            render(
                <CartProduct
                    product={outOfStockProduct}
                    selectedItems={[]}
                    setSelectedItems={mockSetSelectedItems}
                    setTotalShipping={mockSetTotalShipping}
                    userCountry={userCountry}
                />
            )

            expect(screen.getByText('Out of stock')).toBeInTheDocument()
            expect(screen.queryByRole('checkbox', { hidden: true })).not.toBeInTheDocument()
            expect(screen.getByTestId('cart-item-p1-v1-s1')).toHaveClass('bg-red-100')
        })
    })
})
