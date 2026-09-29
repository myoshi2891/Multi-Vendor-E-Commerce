/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import ProductNavigation from './product-navigation'

describe('ProductNavigation', () => {
    const categories = [
        { name: 'Fine Jewels', url: 'fine jewels' },
        { name: 'Watches', url: 'watches' },
    ]
    const offers = [{ name: 'Best Seller', url: 'best-seller' }]

    it('keeps category and offer navigation available', () => {
        render(<ProductNavigation categories={categories} offers={offers} />)

        expect(screen.getByRole('navigation', { name: 'Explore collections' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'The collection' })).toHaveAttribute('href', '/browse')
        expect(screen.getByRole('link', { name: 'Best Seller' })).toHaveAttribute('href', '/browse?offer=best-seller')

        fireEvent.click(screen.getByRole('button', { name: 'Browse categories' }))
        expect(screen.getByRole('link', { name: 'Fine Jewels' })).toHaveAttribute('href', '/browse?category=fine%20jewels')
        expect(screen.getByRole('link', { name: 'Watches' })).toHaveAttribute('href', '/browse?category=watches')
    })
})
