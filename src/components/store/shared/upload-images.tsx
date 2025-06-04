'use client'

import { Button } from '@/components/ui/button'
import { Plus, Trash } from 'lucide-react'
import { CldUploadWidget } from 'next-cloudinary'
import Image from 'next/image'
import { FC, useEffect, useRef, useState } from 'react'

interface ImageUploadProps {
    disabled?: boolean
    onChange: (value: string) => void
    onRemove: (value: string) => void
    value: string[]
    maxImages: number
}

const ImageUploadStore: FC<ImageUploadProps> = ({
    disabled,
    onChange,
    onRemove,
    value,
    maxImages,
}) => {
    const btnRef = useRef<HTMLButtonElement | null>(null)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    if (!isMounted) return null

    const onUpload = (result: any) => {
        onChange(result.info.secure_url)
    }

    return (
        <div>
            <div className="mb-4 flex items-center gap-2">
                {Array.from({ length: maxImages }, (_, index) => index).map(
                    (i) => (
                        <div key={i} className="relative">
                            {/* Delete image btn */}
                            <div className="absolute right-2 top-2 z-10">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="hidden rounded-full"
                                >
                                    <Trash className="size-4" />
                                </Button>
                            </div>
                            {/* Image */}
                            {value[i] ? (
                                <div className="bg-gray-200">
                                    <Image
                                        width={80}
                                        height={80}
                                        className="size-20 rounded-md object-cover"
                                        alt=""
                                        src={value[i]}
                                    />
                                </div>
                            ) : (
                                <div
                                    className="grid size-20 cursor-pointer place-items-center rounded-md bg-gray-200"
                                    onClick={() => btnRef?.current?.click()}
                                >
                                    <Plus className="text-gray-300" />
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>
            <CldUploadWidget onSuccess={onUpload} uploadPreset="fefik77l">
                {({ open }) => {
                    const onClick = () => {
                        open()
                    }

                    return (
                        <>
                            <button
                                type='button'
                                disabled={disabled}
                                ref={btnRef}
                                onClick={onClick}
                                className="hidden"
                            ></button>
                        </>
                    )
                }}
            </CldUploadWidget>
        </div>
    )
}

export default ImageUploadStore
