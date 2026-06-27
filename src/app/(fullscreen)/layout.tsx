// React
import { ReactNode } from 'react'

// Toaster
import { Toaster } from 'react-hot-toast'

/**
 * Wraps full-screen page content.
 *
 * Renders the page content and a top-center toast container within this layout.
 */
export default function FullscreenLayout({ children }: { children: ReactNode }) {
    return (
        <div>
            <div>{children}</div>
            <Toaster position="top-center" />
        </div>
    )
}
