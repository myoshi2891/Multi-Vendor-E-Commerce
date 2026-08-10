import { cn } from '@/lib/utils'
import { Category } from '@prisma/client'
import { ChevronDown, Menu } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {
    Dispatch,
    SetStateAction,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react'

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
    // 表示遅延タイマーの ID。破棄しないと、100ms 以内にマウスが離脱した場合に
    // 「閉じた直後にタイマーが発火して開き直す」競合が起きる（アンマウント後は
    // 解放済みコンポーネントへの setState になる）。
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const listId = useId()

    const clearShowTimer = () => {
        if (showTimerRef.current === null) return
        clearTimeout(showTimerRef.current)
        showTimerRef.current = null
    }

    // アンマウント時に保留中のタイマーを解放する。
    useEffect(() => clearShowTimer, [])

    const toggleMenu = (state: boolean) => {
        setOpen(state)
        clearShowTimer()
        if (!state) {
            setDropdownVisible(false)
            return
        }
        // Delay showing the dropdown until the trigger has finished expanding
        showTimerRef.current = setTimeout(() => {
            showTimerRef.current = null
            setDropdownVisible(true)
        }, 100)
    }
    return (
        <div
            className="relative z-50 size-10 xl:w-[256px]"
            onMouseEnter={() => toggleMenu(true)}
            onMouseLeave={() => toggleMenu(false)}
        >
            {/* Trigger and Dropdown Container */}
            <div className="relative">
                {/* Trigger: hover だけでなく Enter / Space / クリックでも
                    開閉できる実ボタンにする（div ではキーボード操作が
                    一切できず WCAG 2.1.1 違反になる）。 */}
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => toggleMenu(!open)}
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
                </button>
                {/* Dropdown */}
                {/* 閉じているときは invisible（visibility: hidden）にする。
                    max-h-0 / opacity-0 だけでは高さ 0 でもリンクが
                    フォーカス可能なまま残り、Tab が不可視のリンクへ迷い込む。 */}
                <ul
                    id={listId}
                    className={cn(
                        'scrollbar absolute left-0 top-10 w-[256px] overflow-y-auto bg-[#f5f5f5] shadow-lg transition-all duration-100 ease-in-out',
                        {
                            'visible max-h-[523px] opacity-100': dropdownVisible, // Show dropdown
                            'invisible max-h-0 opacity-0': !dropdownVisible, // Hide dropdown
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
