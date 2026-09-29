/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import SocialShare from './social-share'

jest.mock('next-share', () => {
    const Button = ({ children, url, media, 'aria-label': label }: { children: React.ReactNode; url?: string; media?: string; 'aria-label'?: string }) =>
        <button data-url={url} data-media={media} aria-label={label}>{children}</button>
    return {
        FacebookShareButton: Button,
        TwitterShareButton: Button,
        WhatsappShareButton: Button,
        PinterestShareButton: Button,
        FacebookIcon: () => null,
        TwitterIcon: () => null,
        WhatsappIcon: () => null,
        PinterestIcon: () => null,
    }
})

describe('SocialShare', () => {
    it('copies the product URL from a clearly labeled action', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
        render(<SocialShare url="/product/example/variant" quote="Example" />)

        fireEvent.click(screen.getByRole('button', { name: 'Copy product link' }))

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Product link copied to clipboard'))
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/product/example/variant`)
    })

    it('passes an absolute URL to social sharing services', async () => {
        render(<SocialShare url="/product/example/variant" quote="Example" editorial />)
        const facebook = screen.getByRole('button', { name: 'Share on Facebook' })
        expect(facebook).toHaveAttribute('data-url', `${window.location.origin}/product/example/variant`)
        expect(screen.getAllByTestId('share-tile')).toHaveLength(4)
        expect(screen.getAllByTestId('share-tile')[0]).toContainElement(facebook)
        expect(screen.getByRole('button', { name: 'Share on X' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Share on WhatsApp' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Share on Pinterest' })).toBeInTheDocument()
    })

    it('announces a successful copy to screen readers without changing the button name', async () => {
        // Arrange
        const writeText = jest.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
        render(<SocialShare url="/product/example/variant" quote="Example" editorial />)
        expect(screen.getByRole('status')).toBeEmptyDOMElement()

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Copy product link' }))

        // Assert
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Product link copied to clipboard'))
        expect(screen.getByRole('button', { name: 'Copy product link' })).toHaveTextContent('Link copied')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows an error message when copying fails', async () => {
        // Arrange
        const writeText = jest.fn().mockRejectedValue(new Error('denied'))
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
        render(<SocialShare url="/product/example/variant" quote="Example" editorial />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Copy product link' }))

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't copy the link")
        expect(screen.getByRole('status')).toBeEmptyDOMElement()
        expect(screen.getByRole('button', { name: 'Copy product link' })).toHaveTextContent('Copy link')
    })

    it('keeps share URLs relative during server rendering where no origin is available', () => {
        // Arrange & Act: サーバー描画では useSyncExternalStore が getServerSnapshot（空 origin）を使う
        const html = renderToString(<SocialShare url="/product/example/variant" quote="Example" />)

        // Assert
        expect(html).toContain('data-url="/product/example/variant"')
        expect(html).not.toContain(`${window.location.origin}/product/example/variant`)
    })

    it('shares branded fallback media when no product image is provided', () => {
        // Arrange & Act
        render(<SocialShare url="/product/example/variant" quote="Example" editorial />)

        // Assert
        expect(screen.getByRole('button', { name: 'Share on Pinterest' })).toHaveAttribute('data-media', `${window.location.origin}/assets/brand/gem.svg`)
    })
})
