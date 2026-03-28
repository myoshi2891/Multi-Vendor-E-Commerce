import ThemeToggle from '@/components/shared/theme-toggle'
import { UserButton } from '@clerk/nextjs'

/**
 * Renders the application's fixed top header bar containing the user menu and theme toggle.
 *
 * The header is fixed to the top of the viewport with a translucent background, bottom border, and backdrop blur; on medium screens it is offset to accommodate a left sidebar.
 *
 * @returns The header JSX element with the user button and theme toggle aligned to the right.
 */
export default function Header() {
    return (
        <div className="fixed inset-x-0 top-0 z-20 flex items-center gap-4 border-b bg-background/80 p-4 backdrop-blur-md md:left-[300px]">
            <div className="ml-auto flex items-center gap-2">
                <UserButton />
                <ThemeToggle />
            </div>
        </div>
    )
}
