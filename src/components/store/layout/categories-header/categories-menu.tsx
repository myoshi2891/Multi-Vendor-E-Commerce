import { cn } from '@/lib/utils'
import { Category } from '@prisma/client'
import { ChevronDown, Menu } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Dispatch, SetStateAction, useState } from 'react'

export default function CategoriesMenu({
    categories,
    open,
    setOpen,
}: {
    categories: Category[]
    open: boolean
    setOpen: Dispatch<SetStateAction<boolean>>
}) {
    const [dropdownVisible, setDropdownVisible] = useState<boolean>(false)

    const toggleMenu = (state: boolean) => {
        setOpen(state)
        // Delay showing the dropdown until the trigger has finished expanding
        if (state) {
            setTimeout(() => setDropdownVisible(true), 100)
        } else {
            setDropdownVisible(false)
        }
    }
    return (
        <div
            className="relative z-50 size-10 xl:w-[256px]"
            onMouseEnter={() => toggleMenu(true)}
            onMouseLeave={() => toggleMenu(false)}
        >
            {/* Trigger and Dropdown Container */}
            <div className="relative">
                {/* Trigger */}
                <div
                    className={cn(
                        'relative flex h-12 w-12 -translate-y-1 cursor-pointer items-center rounded-full bg-[#535353] text-[20px] text-white transition-all duration-100 ease-in-out xl:h-11 xl:w-[256px] xl:translate-y-0',
                        {
                            'w-[256px] scale-100 rounded-b-none rounded-t-[20px] bg-[#f5f5f5] text-base text-black':
                                open,
                            'scale-75': !open,
                        }
                    )}
                >
                    {/* Menu Icon with transition to move right when open */}
                    <Menu
                        className={cn(
                            'absolute top-1/2 -translate-y-1/2 xl:ml-1',
                            {
                                'left-5': open,
                                'left-3': !open,
                            }
                        )}
                    />
                    <span
                        className={cn('hidden xl:ml-11 xl:inline-flex', {
                            '!ml-14 inline-flex': open,
                        })}
                    >
                        All Categories
                    </span>

                    <ChevronDown
                        className={cn(
                            'absolute right-3 hidden scale-75 xl:inline-flex',
                            {
                                'inline-flex': open,
                            }
                        )}
                    />
                </div>
                {/* Dropdown */}
                <ul
                    className={cn(
                        'scrollbar absolute left-0 top-10 w-[256px] overflow-y-auto bg-[#f5f5f5] shadow-lg transition-all duration-100 ease-in-out',
                        {
                            'max-h-[523px] opacity-100': dropdownVisible, // Show dropdown
                            'max-h-0 opacity-0': !dropdownVisible, // Hide dropdown
                        }
                    )}
                >
                    {categories.map((category) => (
                        // <ul> の直下は <li> でなければならない（WCAG 1.3.1 /
                        // axe: list, listitem）。<Link> は <li> の内側に置く。
                        <li key={category.id} className="m-0">
                            <Link
                                href={`/browse?category=${category.url}`}
                                className="relative flex items-center p-3 pl-6 text-[#222] hover:bg-white"
                            >
                                <Image
                                    src={category.image}
                                    alt={category.name}
                                    width={100}
                                    height={100}
                                    className="size-[18px]"
                                    priority
                                />
                                <span className="ml-2 line-clamp-2 overflow-hidden break-words text-sm font-normal text-main-primary">
                                    {category.name}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
