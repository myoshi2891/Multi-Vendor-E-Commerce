/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Sidebar from '@/components/dashboard/sidebar/sidebar'
import { currentUser } from '@clerk/nextjs/server'

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
    currentUser: jest.fn(),
}))
jest.mock('@/components/shared/logo', () => ({
    __esModule: true,
    default: () => <div data-testid="logo">Logo</div>,
}))
jest.mock('@/components/dashboard/sidebar/user-info', () => ({
    __esModule: true,
    default: () => <div data-testid="user-info">UserInfo</div>,
}))
jest.mock('@/components/dashboard/sidebar/store-switcher', () => ({
    __esModule: true,
    default: () => <div data-testid="store-switcher">StoreSwitcher</div>,
}))
jest.mock('@/components/dashboard/sidebar/nav-admin', () => ({
    __esModule: true,
    default: () => <div data-testid="nav-admin">NavAdmin</div>,
}))
jest.mock('@/components/dashboard/sidebar/nav-seller', () => ({
    __esModule: true,
    default: () => <div data-testid="nav-seller">NavSeller</div>,
}))

describe('Sidebar', () => {
    it('renders admin sidebar', async () => {
        ;(currentUser as jest.Mock).mockResolvedValue({ id: 'u1', firstName: 'John' })
        
        // Render async component
        const SidebarResolved = await Sidebar({ isAdmin: true })
        render(SidebarResolved)

        expect(screen.getByTestId('logo')).toBeInTheDocument()
        expect(screen.getByTestId('user-info')).toBeInTheDocument()
        expect(screen.getByTestId('nav-admin')).toBeInTheDocument()
        expect(screen.queryByTestId('nav-seller')).not.toBeInTheDocument()
    })

    it('renders seller sidebar with store switcher', async () => {
        ;(currentUser as jest.Mock).mockResolvedValue({ id: 'u1', firstName: 'John' })
        
        const SidebarResolved = await Sidebar({ isAdmin: false, stores: [] })
        render(SidebarResolved)

        expect(screen.getByTestId('logo')).toBeInTheDocument()
        expect(screen.getByTestId('user-info')).toBeInTheDocument()
        expect(screen.getByTestId('store-switcher')).toBeInTheDocument()
        expect(screen.getByTestId('nav-seller')).toBeInTheDocument()
        expect(screen.queryByTestId('nav-admin')).not.toBeInTheDocument()
    })
})
