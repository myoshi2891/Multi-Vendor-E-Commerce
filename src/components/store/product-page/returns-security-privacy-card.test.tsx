/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import ReturnsSecurityPrivacyCard from './returns-security-privacy-card'

describe('ReturnsSecurityPrivacyCard', () => {
    it('shows the product return policy and links to actual policy pages', () => {
        render(<ReturnsSecurityPrivacyCard returnPolicy="Return within 14 days." />)
        expect(screen.getByText('Return within 14 days.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Returns & exchanges' })).toHaveAttribute('href', '/returns-exchange')
        expect(screen.getByRole('link', { name: 'Privacy & terms' })).toHaveAttribute('href', '/legal')
    })
})
