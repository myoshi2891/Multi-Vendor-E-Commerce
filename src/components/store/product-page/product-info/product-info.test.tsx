/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import type { ProductPageDataType } from '@/lib/types'
import ProductInfo from './product-info'

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }))
// 子コンポーネントは個別にテスト済みのため、ProductInfo 自身の分岐に集中する
jest.mock('./product-price', () => ({ __esModule: true, default: () => <div data-testid="product-price" /> }))
jest.mock('./size.selector', () => ({ __esModule: true, default: () => <div data-testid="size-selector" /> }))
jest.mock('./variant-selector', () => ({ __esModule: true, default: () => <div data-testid="variant-selector" /> }))
jest.mock('./product-watch', () => ({ __esModule: true, default: () => null }))
jest.mock('../../shared/countdown', () => ({ __esModule: true, default: () => <div data-testid="countdown" /> }))
jest.mock('@/components/shared/color-wheel', () => ({ __esModule: true, default: () => null }))
jest.mock('../../shared/social-share', () => ({
    __esModule: true,
    default: ({ url, media }: { url: string; media?: string }) => <div data-testid="social-share" data-url={url} data-media={media} />,
}))

const buildProductData = (overrides: Record<string, unknown> = {}) => ({
    name: 'Pearl Necklace',
    sku: 'PRL-001',
    colors: [{ name: 'White' }],
    variantInfo: [],
    sizes: [],
    isSale: false,
    saleEndDate: null,
    variantName: 'White Gold',
    variantDescription: '',
    variantId: 'variant-1',
    variantSlug: 'white-gold',
    productSlug: 'pearl-necklace',
    images: [{ url: '/uploads/pearl.jpg' }],
    store: { name: 'Maison Lumière', url: 'maison-lumiere', logo: 'https://res.cloudinary.com/demo/logo.png' },
    rating: 4.5,
    reviewsStatistics: { totalReviews: 0, ratingStatistics: [] },
    ...overrides,
}) as unknown as ProductPageDataType

const renderInfo = (overrides: Record<string, unknown> = {}) =>
    render(
        <ProductInfo
            productData={buildProductData(overrides)}
            sizeId={undefined}
            handleChange={jest.fn()}
            setVariantImages={jest.fn()}
            setActiveImage={jest.fn()}
        />
    )

describe('ProductInfo', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders the headline, rating, and review invitation for an unreviewed product', () => {
        // Arrange & Act
        renderInfo()

        // Assert
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pearl NecklaceWhite Gold')
        expect(screen.getByLabelText('4.50 out of 5 stars')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Be the first to review/ })).toHaveAttribute('href', '#reviews')
        expect(screen.getByText('Color')).toBeInTheDocument()
        expect(screen.queryByTestId('product-summary')).not.toBeInTheDocument()
        expect(screen.queryByTestId('countdown')).not.toBeInTheDocument()
        expect(screen.queryByTestId('variant-selector')).not.toBeInTheDocument()
    })

    it('shows review count, sale countdown, summary, and color choices when available', () => {
        // Arrange & Act
        renderInfo({
            reviewsStatistics: { totalReviews: 12, ratingStatistics: [] },
            isSale: true,
            saleEndDate: '2026-12-31T00:00:00.000Z',
            variantDescription: 'Hand-knotted freshwater pearls.',
            colors: [{ name: 'White' }, { name: 'Gold' }],
            variantInfo: [{ variantSlug: 'white-gold' }],
        })

        // Assert
        expect(screen.getByRole('link', { name: /12 reviews/ })).toBeInTheDocument()
        expect(screen.getByTestId('countdown')).toBeInTheDocument()
        expect(screen.getByTestId('product-summary')).toHaveTextContent('Hand-knotted freshwater pearls.')
        expect(screen.getByText('Choose your color')).toBeInTheDocument()
        expect(screen.getByTestId('variant-selector')).toBeInTheDocument()
    })

    it('links to the store and shares the product page with its first image', () => {
        // Arrange & Act
        renderInfo()

        // Assert
        expect(screen.getByRole('link', { name: /Maison Lumière/ })).toHaveAttribute('href', '/store/maison-lumiere')
        expect(screen.getByTestId('social-share')).toHaveAttribute('data-url', '/product/pearl-necklace/white-gold')
        expect(screen.getByTestId('social-share')).toHaveAttribute('data-media', '/uploads/pearl.jpg')
    })

    it('uses branded artwork when the store logo is a placeholder', () => {
        // Arrange & Act
        renderInfo({ store: { name: 'Maison Lumière', url: 'maison-lumiere', logo: '/assets/images/no_image.png' } })

        // Assert
        expect(screen.getByTestId('curated-by').querySelector('img')).toHaveAttribute('src', expect.stringContaining('star.svg'))
    })

    it('copies the SKU and confirms success', async () => {
        // Arrange
        const writeText = jest.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
        renderInfo()

        // Act
        fireEvent.click(screen.getByRole('button', { name: /PRL-001/ }))

        // Assert
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Copied successfully!'))
        expect(writeText).toHaveBeenCalledWith('PRL-001')
    })

    it('reports a failed SKU copy', async () => {
        // Arrange
        const writeText = jest.fn().mockRejectedValue(new Error('denied'))
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
        renderInfo()

        // Act
        fireEvent.click(screen.getByRole('button', { name: /PRL-001/ }))

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to copy...'))
    })

    it('renders a loading skeleton when product data is missing', () => {
        // Arrange & Act
        const { container } = render(
            <ProductInfo productData={null as unknown as ProductPageDataType} sizeId={undefined} handleChange={jest.fn()} setVariantImages={jest.fn()} setActiveImage={jest.fn()} />
        )

        // Assert
        expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
    })
})
