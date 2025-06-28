import { cn } from '@/lib/utils'
import { SignOutButton, UserButton } from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server'
import { ChevronDown, UserIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '../../../ui/button'
import { Separator } from '@/components/ui/separator'
import { MessageIcon, OrderIcon, WishlistIcon } from '../../../icons'

export default async function UserMenu() {
    // Get the current user
    const user = await currentUser()

    return (
        <div className="group relative">
            {/* Trigger */}
            <div className="">
                {user ? (
                    <Image
                        src={user.imageUrl}
                        alt={user.fullName ? user.fullName : "user name"}
                        width={40}
                        height={40}
                        className="size-10 rounded-full object-cover"
                        priority
                    />
                ) : (
                    <div className="mx-2 flex h-11 cursor-pointer items-center py-0">
                        <span className="text-2xl">
                            <UserIcon />
                        </span>
                        <div className="ml-1">
                            <span className="block text-xs leading-3 text-white">
                                Welcome
                            </span>
                            <b className="text-xs font-bold leading-4 text-white">
                                <span>Sign in / Register</span>
                                <span className="inline-block scale-[60%] align-middle text-white">
                                    <ChevronDown />
                                </span>
                            </b>
                        </div>
                    </div>
                )}
            </div>
            {/* Content */}
            <div
                className={cn(
                    "absolute -left-20 top-0 hidden cursor-pointer group-hover:block",
                    { "-left-[200px] lg:-left-[148px]": user }
                )}
            >
                <div className="relative bottom-auto left-2 right-auto z-40 mt-10 p-0 pt-2.5 text-sm text-[#222]">
                    {/* Triangle */}
                    <div className="absolute left-[149px] right-24 top-1 size-0 !border-b-[10px] !border-x-transparent border-b-white"></div>
                    {/* Menu */}
                    <div className="rounded-3xl bg-white text-sm text-[#222] shadow-lg">
                        <div className="w-[305px]">
                            <div className="px-6 pb-0 pt-5">
                                {user ? (
                                    <div className="user-avatar flex flex-col items-center justify-center">
                                        <UserButton />
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <Link href="/sign-in">
                                            <Button>Sign in</Button>
                                        </Link>
                                        <Link
                                            href="/sign-up"
                                            className="flex h-10 cursor-pointer items-center justify-center text-sm text-main-primary hover:underline"
                                        >
                                            Register
                                        </Link>
                                    </div>
                                )}
                                {user && (
                                    <p className="my-3 cursor-pointer text-center text-sm text-main-primary">
                                        <SignOutButton />
                                    </p>
                                )}
                                <Separator />
                            </div>
                            {/* Link */}
                            <div className="max-w-[calc(100vh-180px)] overflow-y-auto overflow-x-hidden px-2 pb-4 pt-0 text-main-secondary">
                                <ul className="grid w-full grid-cols-3 gap-2 px-4 py-2.5">
                                    {links.map((item) => (
                                        <li
                                            key={item.title}
                                            className="grid place-items-center"
                                        >
                                            <Link
                                                href={item.link}
                                                className="space-y-2"
                                            >
                                                <div className="grid size-14 place-items-center rounded-full bg-gray-100 p-2 hover:bg-gray-200">
                                                    <span className="text-gray-500">
                                                        {item.icon}
                                                    </span>
                                                </div>
                                                <span className="block text-xs">
                                                    {item.title}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                                <Separator className="mx-auto !max-w-[257px]" />
                                <ul className="w-[288px] px-4 pb-1 pt-2.5">
                                    {extraLinks.map((item, i) => (
                                        <li key={i}>
                                            <Link
                                                href={item.link}
                                                legacyBehavior
                                            >
                                                <a className="block py-1.5 text-sm text-main-primary hover:underline">
                                                    {item.title}
                                                </a>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const links = [
    {
        icon: <OrderIcon />,
        title: 'My Orders',
        link: '/profile/orders',
    },
    {
        icon: <MessageIcon />,
        title: 'Messages',
        link: '/profile/messages',
    },
    {
        icon: <WishlistIcon />,
        title: 'WishList',
        link: '/profile/wishlist',
    },
]
const extraLinks = [
    {
        title: 'Profile',
        link: '/profile',
    },
    {
        title: 'Settings',
        link: '/',
    },
    {
        title: 'Become a Seller',
        link: '/become-seller',
    },
    {
        title: 'Help Center',
        link: '',
    },
    {
        title: 'Return & Refund Policy',
        link: '/',
    },
    {
        title: 'Legal & Privacy',
        link: '',
    },
    {
        title: 'Discounts & Offers',
        link: '',
    },
    {
        title: 'Order Dispute Resolution',
        link: '',
    },
    {
        title: 'Report a Problem',
        link: '',
    },
]
