import COUNTRIES from '@/data/countries.json'
import { SelectMenuOption } from '@/lib/types'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import React, { MutableRefObject, useEffect, useRef, useState } from 'react'

export interface CountrySelectorProps {
    id: string
    open: boolean
    disabled?: boolean
    onToggle: () => void
    onChange: (value: SelectMenuOption['name']) => void
    selectedValue: SelectMenuOption
}

export default function CountrySelector({
    id,
    open,
    disabled = false,
    onToggle,
    onChange,
    selectedValue,
}: CountrySelectorProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const mutableRef = ref as MutableRefObject<HTMLDivElement | null>

        const handleClickOutside = (event: any) => {
            if (
                mutableRef.current &&
                !mutableRef.current.contains(event.target) &&
                open
            ) {
                onToggle()
                setQuery('')
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [ref])

    const [query, setQuery] = useState('')

    return (
        <div ref={ref}>
            <div className="relative mt-1">
                <button
                    type="button"
                    className={`${
                        disabled ? 'bg-neutral-100' : 'bg-white'
                    } relative w-full cursor-default rounded-md border border-black/20 py-2 pl-3 pr-10 text-left focus:outline-none focus:ring-1 sm:text-sm`}
                    aria-haspopup="listbox"
                    aria-expanded="true"
                    aria-labelledby="listbox-label"
                    onClick={onToggle}
                    disabled={disabled}
                >
                    <span className="flex items-center truncate">
                        <Image
                            alt={`${selectedValue.name}`}
                            src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${selectedValue.code}.svg`}
                            className="mr-2 inline size-auto h-4 rounded-sm"
                            priority
                            width={20}
                            height={20}
                        />
                        {selectedValue.name}
                    </span>
                    <span
                        className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 ${
                            disabled ? 'hidden' : ''
                        }`}
                    >
                        <svg
                            className="size-5 text-gray-400"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </span>
                </button>

                <AnimatePresence>
                    {open && (
                        <motion.ul
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.1 }}
                            className="absolute z-10 mt-1 max-h-80 w-full rounded-md bg-white text-base shadow-sm ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                            tabIndex={-1}
                            role="listbox"
                            aria-labelledby="listbox-label"
                            aria-activedescendant="listbox-option-3"
                        >
                            <div className="sticky top-0 z-10 bg-white">
                                <li className="relative cursor-default select-none px-3 py-2 text-gray-900">
                                    <input
                                        type="search"
                                        name="search"
                                        autoComplete={'off'}
                                        className="block w-full rounded-md outline-none sm:text-sm"
                                        placeholder={'Search a country'}
                                        onChange={(e) =>
                                            setQuery(e.target.value)
                                        }
                                    />
                                </li>
                                <hr />
                            </div>

                            <div
                                className={
                                    'scrollbar scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-600 scrollbar-thumb-rounded scrollbar-thin max-h-64 overflow-y-scroll'
                                }
                            >
                                {COUNTRIES.filter((country) =>
                                    country.name
                                        .toLowerCase()
                                        .startsWith(query.toLowerCase())
                                ).length === 0 ? (
                                    <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900">
                                        No countries found
                                    </li>
                                ) : (
                                    COUNTRIES.filter((country) =>
                                        country.name
                                            .toLowerCase()
                                            .startsWith(query.toLowerCase())
                                    ).map((value, index) => {
                                        return (
                                            <li
                                                key={`${id}-${index}`}
                                                className="relative flex cursor-default select-none items-center py-2 pl-3 pr-9 text-gray-900 transition hover:bg-gray-50"
                                                id="listbox-option-0"
                                                role="option"
                                                aria-selected="false"
                                                onClick={() => {
                                                    onChange(value.name)
                                                    setQuery('')
                                                    onToggle()
                                                }}
                                            >
                                                <Image
                                                    alt={`${value.name}`}
                                                    src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${value.code}.svg`}
                                                    className="mr-2 inline h-4 rounded-sm"
                                                    width={20}
                                                    height={20}
                                                    priority
                                                    style={{ width: 'auto' }}
                                                />

                                                <span className="truncate font-normal">
                                                    {value.name}
                                                </span>
                                                {value.name ===
                                                selectedValue.name ? (
                                                    <span className="absolute inset-y-0 right-0 flex items-center pr-8 text-blue-600">
                                                        <svg
                                                            className="size-5"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            viewBox="0 0 20 20"
                                                            fill="currentColor"
                                                            aria-hidden="true"
                                                            width={5}
                                                            height={5}
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    </span>
                                                ) : null}
                                            </li>
                                        )
                                    })
                                )}
                            </div>
                        </motion.ul>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
