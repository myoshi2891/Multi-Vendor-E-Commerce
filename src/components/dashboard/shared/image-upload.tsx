'use client'

// React, Next.js
import { FC, useEffect, useState } from 'react'
import Image from 'next/image'

// Cloudinary
import { CldUploadWidget } from 'next-cloudinary'
import { Button } from '@/components/ui/button'
import { Trash } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
    disabled?: boolean
    onChange: (value: string) => void
    onRemove: (value: string) => void
    value: string[]
    type: 'standard' | 'profile' | 'cover'
    dontShowPreview?: boolean
    error?: boolean
}

const ImageUpload: FC<ImageUploadProps> = ({
    disabled,
    onChange,
    onRemove,
    value,
    type,
    dontShowPreview,
    error,
}) => {
    const [isMounted, setIsMounted] = useState(false)
    const [isBouncing, setIsBouncing] = useState(false) // Add state for bounce

    useEffect(() => {
        if (error) {
            setIsBouncing(true)
            const timer = setTimeout(() => {
                setIsBouncing(false) // Stop the bounce after 1 and half second
            }, 1500)
            return () => clearTimeout(timer) // Clean up timer if the component unmounts or error changes
        }
    }, [error])

    useEffect(() => {
        setIsMounted(true)
    }, [])

    if (!isMounted) {
        return null
    }

    const onUpload = (result: any) => {
        onChange(result.info.secure_url)
    }

    if (type === 'profile') {
        return (
            <div
                className={cn(
                    'relative h-52 w-52 overflow-visible rounded-full border-2 border-white bg-gray-200 shadow-2xl',
                    {
                        'bg-red-100': error,
                        'animate-pulse': isBouncing,
                    }
                )}
            >
                {value.length > 0 && (
                    <Image
                        priority
                        src={value[0]}
                        alt="image for profile picture"
                        width={300}
                        height={300}
                        className="absolute inset-0 size-52 rounded-full object-cover"
                    />
                )}
                <CldUploadWidget onSuccess={onUpload} uploadPreset="fefik77l">
                    {({ open }) => {
                        const onClick = () => {
                            open()
                        }

                        return (
                            <>
                                <button
                                    type="button"
                                    className="absolute bottom-6 right-0 z-20 flex size-14 items-center justify-center rounded-full border-none bg-gradient-to-t from-blue-primary to-blue-300 text-[17px] font-medium text-white shadow-lg hover:shadow-md active:shadow-sm"
                                    disabled={disabled}
                                    onClick={onClick}
                                >
                                    <svg
                                        viewBox="0 0 640 512"
                                        fill="white"
                                        height="1em"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-217c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l39-39V392c0 13.3 10.7 24 24 24s24-10.7 24-24V257.9l39 39c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-80-80c-9.4-9.4-24.6-9.4-33.9 0l-80 80z" />
                                    </svg>
                                </button>
                            </>
                        )
                    }}
                </CldUploadWidget>
            </div>
        )
    } else if (type === 'cover') {
        return (
            <div
                className={cn(
                    'relative w-full overflow-hidden rounded-lg bg-gray-100 bg-gradient-to-b from-gray-100 via-gray-100 to-gray-400',
                    {
                        'from-red-100 to-red-200': error,
                        'animate-bounce': isBouncing,
                    }
                )}
                style={{ height: '348px' }}
            >
                {value.length > 0 && (
                    <Image
                        priority
                        src={value[0]}
                        alt="image for cover picture"
                        width={1200}
                        height={1200}
                        className="size-full rounded-lg object-cover"
                    />
                )}
                <CldUploadWidget onSuccess={onUpload} uploadPreset="fefik77l">
                    {({ open }) => {
                        const onClick = () => {
                            open()
                        }

                        return (
                            <button
                                type="button"
                                className="absolute bottom-4 right-4 flex items-center rounded-full border-none bg-gradient-to-t from-blue-primary to-blue-300 px-6 py-3 text-[17px] font-medium text-white shadow-lg hover:shadow-md active:shadow-sm"
                                disabled={disabled}
                                onClick={onClick}
                            >
                                <svg
                                    viewBox="0 0 640 512"
                                    fill="white"
                                    height="1em"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="mr-2"
                                >
                                    <path d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-217c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l39-39V392c0 13.3 10.7 24 24 24s24-10.7 24-24V257.9l39 39c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-80-80c-9.4-9.4-24.6-9.4-33.9 0l-80 80z" />
                                </svg>
                                <span>
                                    {value.length > 0
                                        ? 'Change cover'
                                        : 'Upload a cover'}
                                </span>
                            </button>
                        )
                    }}
                </CldUploadWidget>
            </div>
        )
    } else {
        return (
            <div>
                <div className="mb-4 flex items-center gap-4">
                    {value.length > 0 &&
                        !dontShowPreview &&
                        value.map((imageUrl) => (
                            <div
                                key={imageUrl}
                                className="relative max-h-[200px] min-h-[100px] w-[200px]"
                            >
                                {/* Delete image btn */}
                                <div className="absolute right-2 top-2 z-10">
                                    <Button
                                        onClick={() => onRemove(imageUrl)}
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="rounded-full"
                                    >
                                        <Trash className="size-4" />
                                    </Button>
                                </div>
                                {/* Image */}
                                <Image
                                    priority
                                    fill
                                    className="rounded-md object-cover"
                                    alt="image for product"
                                    src={imageUrl}
                                />
                            </div>
                        ))}
                </div>
                <CldUploadWidget onSuccess={onUpload} uploadPreset="fefik77l">
                    {({ open }) => {
                        const onClick = () => {
                            open()
                        }

                        return (
                            <>
                                <button
                                    type="button"
                                    className="flex items-center rounded-full border-none bg-gradient-to-t from-blue-primary to-blue-300 px-6 py-3 text-[17px] font-medium text-white shadow-lg hover:shadow-md active:shadow-sm"
                                    disabled={disabled}
                                    onClick={onClick}
                                >
                                    <svg
                                        viewBox="0 0 640 512"
                                        fill="white"
                                        height="1em"
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="mr-2"
                                    >
                                        <path d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-217c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l39-39V392c0 13.3 10.7 24 24 24s24-10.7 24-24V257.9l39 39c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-80-80c-9.4-9.4-24.6-9.4-33.9 0l-80 80z" />
                                    </svg>
                                    <span>Upload images</span>
                                </button>
                            </>
                        )
                    }}
                </CldUploadWidget>
            </div>
        )
    }
}

export default ImageUpload
