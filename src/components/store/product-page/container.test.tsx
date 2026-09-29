/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react'
import toast from 'react-hot-toast'
import { setCookie } from 'cookies-next'
import type { CartProductType, ProductPageDataType } from '@/lib/types'
import { updateProductHistory } from '@/lib/utils'
import ProductPageContainer from './container'

const mockPush = jest.fn()
const mockAddToCart = jest.fn()
const mockSetCart = jest.fn()
// useFromStore の useEffect 依存が毎レンダー変わらないよう、状態は参照を固定する
const mockCartState: { addToCart: jest.Mock; setCart: jest.Mock; cart: CartProductType[] } = {
    addToCart: mockAddToCart,
    setCart: mockSetCart,
    cart: [],
}

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('cookies-next', () => ({ setCookie: jest.fn() }))
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/cart-store/useCartStore', () => ({
    useCartStore: (selector: (state: typeof mockCartState) => unknown) => selector(mockCartState),
}))
jest.mock('@/lib/utils', () => ({
    ...jest.requireActual('@/lib/utils'),
    updateProductHistory: jest.fn(),
}))
jest.mock('./product-swiper', () => ({
    __esModule: true,
    default: ({ images, activeImage }: { images: { id: string }[]; activeImage: { id: string } | null }) => (
        <div data-testid="swiper" data-count={images.length} data-active={activeImage?.id} />
    ),
}))
// ProductInfo は選択操作の起点。handleChange / setter を直接叩けるボタンに置き換える
jest.mock('./product-info/product-info', () => ({
    __esModule: true,
    default: ({ handleChange, setVariantImages, setActiveImage }: {
        handleChange: <K extends keyof CartProductType>(property: K, value: CartProductType[K]) => void
        setVariantImages: (images: unknown[]) => void
        setActiveImage: (image: unknown) => void
    }) => (
        <div>
            <button type="button" onClick={() => {
                handleChange('size', 'M')
                handleChange('price', 120)
                handleChange('stock', 3)
            }}>select size</button>
            <button type="button" onClick={() => handleChange('size', 'M')}>reselect same size</button>
            <button type="button" onClick={() => { setVariantImages([]); setActiveImage(null) }}>clear images</button>
        </div>
    ),
}))
jest.mock('./shipping/ship-to', () => ({ __esModule: true, default: () => <div data-testid="ship-to" /> }))
jest.mock('./shipping/shipping-details', () => ({ __esModule: true, default: () => <div data-testid="shipping-details" /> }))
jest.mock('./returns-security-privacy-card', () => ({ __esModule: true, default: () => <div data-testid="returns-card" /> }))
jest.mock('./quantity-selector', () => ({ __esModule: true, default: () => <div data-testid="quantity-selector" /> }))

const shippingDetails = {
    shippingFeeMethod: 'ITEM',
    shippingService: 'Express',
    shippingFee: 10,
    extraShippingFee: 5,
    deliveryTimeMin: 2,
    deliveryTimeMax: 5,
    isFreeShipping: false,
    returnPolicy: '30 days',
    countryCode: 'US',
    countryName: 'United States',
    city: 'New York',
}

const buildProductData = (overrides: Record<string, unknown> = {}) => ({
    productId: 'product-1',
    variantId: 'variant-1',
    productSlug: 'pearl-necklace',
    variantSlug: 'white-gold',
    name: 'Pearl Necklace',
    variantName: 'White Gold',
    variantImage: '/uploads/variant.jpg',
    weight: 0.2,
    sizes: [{ id: 'size-1', size: 'M', quantity: 3 }, { id: 'size-2', size: 'L', quantity: 0 }],
    images: [{ id: 'img-1', url: '/uploads/pearl.jpg' }, { id: 'img-2', url: '/uploads/clasp.jpg' }],
    shippingDetails,
    ...overrides,
}) as unknown as ProductPageDataType

const renderContainer = (sizeId: string | undefined, overrides: Record<string, unknown> = {}) =>
    render(
        <ProductPageContainer productData={buildProductData(overrides)} sizeId={sizeId}>
            <p>below the fold</p>
        </ProductPageContainer>
    )

const buyButton = () => screen.getByRole('button', { name: /Buy now/ })
const cartButton = () => screen.getByTestId('add-to-cart')

describe('ProductPageContainer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockCartState.cart = []
    })

    it('renders nothing without product data', () => {
        const { container } = render(
            <ProductPageContainer productData={null as unknown as ProductPageDataType} sizeId={undefined}><p>x</p></ProductPageContainer>
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('asks for a size before purchase and records the product view', () => {
        // Arrange & Act
        renderContainer(undefined)

        // Assert
        expect(buyButton()).toBeDisabled()
        expect(cartButton()).toBeDisabled()
        expect(screen.getByText('Select a size to continue.')).toBeInTheDocument()
        expect(screen.queryByTestId('quantity-selector')).not.toBeInTheDocument()
        expect(screen.getByTestId('ship-to')).toBeInTheDocument()
        expect(screen.getByText('below the fold')).toBeInTheDocument()
        expect(updateProductHistory).toHaveBeenCalledWith('variant-1')
        expect(setCookie).toHaveBeenCalledWith('viewedProduct_product-1', 'true', { maxAge: 3600, path: '/' })
    })

    it('tells shoppers the piece is sold out instead of asking for a size when every size is out of stock', () => {
        // Arrange & Act
        renderContainer(undefined, { sizes: [{ id: 'size-1', size: 'M', quantity: 0 }, { id: 'size-2', size: 'L', quantity: -1 }] })

        // Assert
        expect(screen.getByText('This piece is currently out of stock.')).toBeInTheDocument()
        expect(screen.queryByText('Select a size to continue.')).not.toBeInTheDocument()
    })

    it('shows neither hint once a size is selected', () => {
        // Arrange & Act
        renderContainer('size-1')

        // Assert
        expect(screen.queryByText('Select a size to continue.')).not.toBeInTheDocument()
        expect(screen.queryByText('This piece is currently out of stock.')).not.toBeInTheDocument()
    })

    it('hides shipping information when the product cannot ship', () => {
        // Arrange & Act
        renderContainer(undefined, { shippingDetails: false })

        // Assert
        expect(screen.queryByTestId('ship-to')).not.toBeInTheDocument()
        expect(screen.queryByTestId('shipping-details')).not.toBeInTheDocument()
    })

    it('adds the selected size to the bag', () => {
        // Arrange
        renderContainer('size-1')
        fireEvent.click(screen.getByRole('button', { name: 'select size' }))
        fireEvent.click(screen.getByRole('button', { name: 'reselect same size' }))

        // Act
        fireEvent.click(cartButton())

        // Assert
        expect(screen.getByTestId('quantity-selector')).toBeInTheDocument()
        expect(mockAddToCart).toHaveBeenCalledWith(expect.objectContaining({ sizeId: 'size-1', size: 'M', price: 120, stock: 3 }))
        expect(toast.success).toHaveBeenCalledWith('Added to your bag')
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('adds the item and goes to the cart on Buy now', () => {
        // Arrange
        renderContainer('size-1')
        fireEvent.click(screen.getByRole('button', { name: 'select size' }))

        // Act
        fireEvent.click(buyButton())

        // Assert
        expect(mockAddToCart).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith('/cart')
    })

    it('blocks purchase when the bag already holds all remaining stock', () => {
        // Arrange
        mockCartState.cart = [{ productId: 'product-1', variantId: 'variant-1', sizeId: 'size-1', stock: 3, quantity: 3 } as CartProductType]
        renderContainer('size-1')

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'select size' }))

        // Assert
        expect(buyButton()).toBeDisabled()
        expect(cartButton()).toBeDisabled()
    })

    it('measures remaining stock against current inventory rather than the stale stock saved in the bag', () => {
        // Arrange: カート投入時は在庫 10 だったが、現在の在庫は 3 でその 3 点が既にカートにある
        mockCartState.cart = [{ productId: 'product-1', variantId: 'variant-1', sizeId: 'size-1', stock: 10, quantity: 3 } as CartProductType]
        renderContainer('size-1')

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'select size' }))

        // Assert
        expect(buyButton()).toBeDisabled()
        expect(cartButton()).toBeDisabled()
    })

    it('falls back to the product images when the variant image list is cleared', () => {
        // Arrange
        renderContainer(undefined)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'clear images' }))

        // Assert
        expect(screen.getByTestId('swiper')).toHaveAttribute('data-count', '2')
        expect(screen.getByTestId('swiper')).toHaveAttribute('data-active', 'img-1')
    })

    describe('cart sync across tabs', () => {
        const dispatchStorage = (key: string, newValue: string | null) =>
            act(() => {
                window.dispatchEvent(new StorageEvent('storage', { key, newValue }))
            })

        it('updates the cart when another tab changes it', () => {
            // Arrange
            renderContainer(undefined)
            const cart = [{ productId: 'product-2' }]

            // Act
            dispatchStorage('cart', JSON.stringify({ state: { cart } }))

            // Assert
            expect(mockSetCart).toHaveBeenCalledWith(cart)
        })

        it('ignores unrelated keys, cleared values, and malformed state', () => {
            // Arrange
            renderContainer(undefined)

            // Act
            dispatchStorage('wishlist', JSON.stringify({ state: { cart: [] } }))
            dispatchStorage('cart', null)
            dispatchStorage('cart', JSON.stringify({ state: { cart: 'not-an-array' } }))

            // Assert
            expect(mockSetCart).not.toHaveBeenCalled()
        })

        it('logs and survives unparsable cart data', () => {
            // Arrange
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
            renderContainer(undefined)

            // Act
            dispatchStorage('cart', '{broken')

            // Assert
            expect(consoleSpy).toHaveBeenCalledWith('Failed to parse updated cart data:', expect.any(SyntaxError))
            expect(mockSetCart).not.toHaveBeenCalled()
            consoleSpy.mockRestore()
        })
    })
})
