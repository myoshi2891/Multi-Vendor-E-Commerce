// React
import { ReactNode } from 'react'

// Layout chrome
import StoreHeader from '@/components/store/layout/header/header'
import Footer from '@/components/store/layout/footer/footer'

/**
 * Provides the shared layout for authentication pages.
 *
 * @param children - The page content to render within the main area.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <StoreHeader />
            <main className="flex flex-1 flex-col">{children}</main>
            <Footer />
        </div>
    )
}
