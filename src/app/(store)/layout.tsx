// React
import { ReactNode } from 'react'

// Toaster
import { Toaster } from 'react-hot-toast'

// Layout chrome
import StoreHeader from '@/components/store/layout/header/header'
import Footer from '@/components/store/layout/footer/footer'

/**
 * Renders the shared storefront layout with the store header, footer, and toast notifications.
 */
export default function StoreLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <StoreHeader />
            <div className="flex-1">{children}</div>
            <Footer />
            <Toaster position="top-center" />
        </div>
    )
}
