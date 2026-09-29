/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import type { ProductType } from '@/lib/types'
import EditorialProductGrid from './editorial-product-grid'

const product = {
    id: 'pearl',
    slug: 'pearl-earrings',
    name: 'Pearl Drop Earrings',
    variants: [{
        variantSlug: 'white-gold',
        variantName: 'White Gold',
        images: [{ url: '/assets/images/no_image.png' }],
        sizes: [{ price: 120, discount: 10 }],
    }],
} as unknown as ProductType

describe('EditorialProductGrid', () => {
    it('shows a product link, discounted price, and branded fallback artwork', () => {
        render(<EditorialProductGrid products={[product]} title="Related products" />)

        expect(screen.getByRole('heading', { name: 'Related products' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Pearl Drop Earrings/ })).toHaveAttribute('href', '/product/pearl-earrings/white-gold')
        expect(screen.getByText('$108.00')).toBeInTheDocument()
        expect(screen.getByTestId('editorial-product-image')).toHaveAttribute('src', expect.stringContaining('/assets/brand/gem.svg'))
    })
})
