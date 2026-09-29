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

    describe('category menu dismissal', () => {
        const openMenu = () => {
            render(<ProductNavigation categories={categories} offers={offers} />)
            const trigger = screen.getByRole('button', { name: 'Browse categories' })
            fireEvent.click(trigger)
            return trigger
        }

        it('closes on Escape but not on other keys', () => {
            // Arrange
            const trigger = openMenu()

            // Act & Assert
            fireEvent.keyDown(document, { key: 'Tab' })
            expect(trigger).toHaveAttribute('aria-expanded', 'true')
            fireEvent.keyDown(document, { key: 'Escape' })
            expect(trigger).toHaveAttribute('aria-expanded', 'false')
        })

        it('closes on an outside click but stays open for clicks inside the menu', () => {
            // Arrange
            const trigger = openMenu()

            // Act & Assert
            fireEvent.mouseDown(screen.getByText('EXPLORE BY CATEGORY'))
            expect(trigger).toHaveAttribute('aria-expanded', 'true')
            fireEvent.mouseDown(document.body)
            expect(trigger).toHaveAttribute('aria-expanded', 'false')
        })

        it('closes after choosing a category and toggles closed from the trigger', () => {
            // Arrange
            const trigger = openMenu()

            // Act & Assert
            fireEvent.click(screen.getByRole('link', { name: 'Watches' }))
            expect(trigger).toHaveAttribute('aria-expanded', 'false')
            fireEvent.click(trigger)
            fireEvent.click(trigger)
            expect(trigger).toHaveAttribute('aria-expanded', 'false')
        })
    })

    it('limits the offer rail to seven offers', () => {
        // Arrange
        const manyOffers = Array.from({ length: 9 }, (_, i) => ({ name: `Offer ${i + 1}`, url: `offer-${i + 1}` }))

        // Act
        render(<ProductNavigation categories={[]} offers={manyOffers} />)

        // Assert
        expect(screen.getByRole('link', { name: 'Offer 7' })).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Offer 8' })).not.toBeInTheDocument()
    })
})
