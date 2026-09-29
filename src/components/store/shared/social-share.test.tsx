/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react'
import SocialShare from './social-share'

jest.mock('next-share', () => {
    const Button = ({ children, url, 'aria-label': label }: { children: React.ReactNode; url?: string; 'aria-label'?: string }) =>
        <button data-url={url} aria-label={label}>{children}</button>
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

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy product link' }))
        })
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
})
