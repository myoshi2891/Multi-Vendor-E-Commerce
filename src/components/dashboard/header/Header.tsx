import ThemeToggle from '@/components/shared/theme-toggle'
import { UserButton } from '@clerk/nextjs'

export default function Header() {
    return (
        <div className="fixed inset-x-0 top-0 z-20 flex items-center gap-4 border-b bg-background/80 p-4 backdrop-blur-md md:left-[300px]">
            <div className="ml-auto flex items-center gap-2">
                <UserButton afterSignOutUrl="/" />
                <ThemeToggle />
            </div>
        </div>
    )
}
