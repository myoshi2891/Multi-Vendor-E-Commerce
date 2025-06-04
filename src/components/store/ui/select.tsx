import { cn } from '@/lib/utils'
import { OptionIcon } from 'lucide-react'
import Image from 'next/image'
import { FC, useState } from 'react'

interface Props {
    name: string
    value: string
    placeholder?: string
    subPlaceholder?: string
    onChange: (value: string) => void
    options: { name: string; value: string; image?: string; colors?: string }[]
}

const Select: FC<Props> = ({
    name,
    value,
    placeholder,
    subPlaceholder,
    onChange,
    options,
}) => {
    const [isOpen, setIsOpen] = useState<boolean>(false)
    const [activeVariant, setActiveVariant] = useState(
        options.find((o) => o.value === value)
    )

    const toggleDropdown = () => {
        setIsOpen((prev) => !prev)
    }

    // Handle option click
    const handleOptionClick = (option: string) => {
        onChange(option)
        setActiveVariant(options.find((o) => o.value === option))
        setIsOpen(false)
    }

    return (
        <div className="relative z-50 w-full">
            <div>
                <div className="relative">
                    {activeVariant?.image && (
                        <Image
                            src={activeVariant.image}
                            alt=""
                            height={50}
                            width={50}
                            className="absolute left-2 top-1/2 size-10 -translate-y-1/2 rounded-full object-cover object-top shadow-md"
                        />
                    )}
                    <input
                        className={cn(
                            'w-full rounded-xl py-4 pl-8 pr-6 outline-none duration-200',
                            {
                                'ring-1 ring-[transparent] focus:ring-[#11BE86]':
                                    !activeVariant?.colors,
                                'pl-14': activeVariant?.image,
                            }
                        )}
                        placeholder={placeholder}
                        value={value}
                        onFocus={toggleDropdown}
                        onBlur={() => setIsOpen(false)}
                        onChange={(e) => onChange(e.target.value)}
                    />
                </div>
            </div>
            {isOpen && (
                <div className="absolute left-0 top-16 w-full rounded-xl border bg-white p-4 shadow-lg">
                    <p className="text-xs font-semibold text-[#5d5d5f]">
                        {subPlaceholder}
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                        {options.map((option, index) => (
                            <li
                                key={index}
                                className="flex cursor-pointer items-center gap-x-2 rounded-lg p-2 text-sm hover:bg-green-100"
                                onMouseDown={() =>
                                    handleOptionClick(option.value)
                                }
                            >
                                {option.image && (
                                    <Image
                                        src={option.image}
                                        alt=""
                                        height={100}
                                        width={100}
                                        className="size-10 rounded-full object-cover object-top shadow-md"
                                    />
                                )}
                                {option.name}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default Select
