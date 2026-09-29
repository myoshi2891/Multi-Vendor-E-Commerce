/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { useUser } from '@clerk/nextjs'
import { followStore } from '@/queries/user'
import StoreCard from './store-card'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@clerk/nextjs', () => ({ useUser: jest.fn() }))
jest.mock('@/queries/user', () => ({ followStore: jest.fn() }))
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }))

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>
const mockFollowStore = followStore as jest.MockedFunction<typeof followStore>

const store = {
    id: 'store-1',
    url: 'maison-lumiere',
    name: 'Maison Lumière',
    logo: 'https://res.cloudinary.com/demo/logo.png',
    followersCount: 10,
    isUserFollowingStore: false,
}

const signIn = (isLoaded: boolean, isSignedIn: boolean) =>
    mockUseUser.mockReturnValue({ isLoaded, isSignedIn } as ReturnType<typeof useUser>)

describe('StoreCard (editorial)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('shows boutique identity with a link to the store and branded fallback logo', () => {
        // Arrange
        signIn(true, true)

        // Act
        render(<StoreCard store={{ ...store, logo: '/assets/images/no_image.png' }} editorial />)

        // Assert
        expect(screen.getByRole('region', { name: 'About Maison Lumière' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Visit boutique/ })).toHaveAttribute('href', '/store/maison-lumiere')
        expect(screen.getByText('10 followers')).toBeInTheDocument()
        expect(document.querySelector('img')).toHaveAttribute('src', expect.stringContaining('star.svg'))
    })

    it('follows the store and increments the follower count', async () => {
        // Arrange
        signIn(true, true)
        mockFollowStore.mockResolvedValue(true)
        render(<StoreCard store={store} editorial />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: /Follow boutique/ }))

        // Assert
        expect(await screen.findByText('11 followers')).toBeInTheDocument()
        expect(mockFollowStore).toHaveBeenCalledWith('store-1')
        expect(screen.getByRole('button', { name: /Following/ })).toHaveAttribute('aria-pressed', 'true')
        expect(toast.success).toHaveBeenCalledWith('You are now following Maison Lumière', { duration: 3000 })
    })

    it('unfollows the store and decrements the follower count', async () => {
        // Arrange
        signIn(true, true)
        mockFollowStore.mockResolvedValue(false)
        render(<StoreCard store={{ ...store, isUserFollowingStore: true }} editorial />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: /Following/ }))

        // Assert
        expect(await screen.findByText('9 followers')).toBeInTheDocument()
        expect(toast.success).toHaveBeenCalledWith('You unfollowed Maison Lumière', { duration: 3000 })
    })

    it('redirects signed-out users to sign in without calling the server action', () => {
        // Arrange
        signIn(true, false)
        render(<StoreCard store={store} editorial />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: /Follow boutique/ }))

        // Assert
        expect(mockPush).toHaveBeenCalledWith('/sign-in')
        expect(mockFollowStore).not.toHaveBeenCalled()
    })

    it('shows an error toast when following fails', async () => {
        // Arrange
        signIn(true, true)
        mockFollowStore.mockRejectedValue(new Error('db down'))
        render(<StoreCard store={store} editorial />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: /Follow boutique/ }))

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Something happened, Try again later.'))
        expect(screen.getByText('10 followers')).toBeInTheDocument()
    })

    it('keeps the follow button disabled until Clerk has loaded', () => {
        // Arrange
        signIn(false, false)

        // Act
        render(<StoreCard store={store} editorial />)

        // Assert
        expect(screen.getByRole('button', { name: /Follow boutique/ })).toBeDisabled()
    })
})

describe('StoreCard (default)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders the compact card and follows from the pill button', async () => {
        // Arrange
        signIn(true, true)
        mockFollowStore.mockResolvedValue(true)
        render(<StoreCard store={store} />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: /Follow/ }))

        // Assert
        await waitFor(() => expect(screen.getByRole('button', { name: /Following/ })).toHaveAttribute('aria-pressed', 'true'))
        screen.getAllByRole('link', { name: 'Maison Lumière' }).forEach((link) => expect(link).toHaveAttribute('href', '/store/maison-lumiere'))
        expect(screen.getByText('11')).toBeInTheDocument()
    })
})
