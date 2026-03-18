/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Header from '@/components/dashboard/header/Header'

// Mock Clerk and ThemeToggle
jest.mock('@clerk/nextjs', () => ({
    UserButton: () => <div data-testid="user-button">UserButton</div>,
}))
jest.mock('@/components/shared/theme-toggle', () => ({
    __esModule: true,
    default: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}))

describe('DashboardHeader', () => {
    it('renders UserButton and ThemeToggle', () => {
        render(<Header />)

        expect(screen.getByTestId('user-button')).toBeInTheDocument()
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
    })
})
