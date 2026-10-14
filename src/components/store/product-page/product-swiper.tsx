'use client'

import Image from 'next/image'
import { Dispatch, SetStateAction, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ProductVariantImage } from '@prisma/client'
import { ArrowLeft, ArrowRight, X, ZoomIn } from 'lucide-react'
import styles from './product.module.css'

export default function ProductSwiper({
    images,
    activeImage,
    setActiveImage,
    productName,
}: Readonly<{
    images: ProductVariantImage[]
    activeImage: ProductVariantImage | null
    setActiveImage: Dispatch<SetStateAction<ProductVariantImage | null>>
    productName?: string
}>) {
    const [isZoomOpen, setIsZoomOpen] = useState(false)
    if (!images?.length) return null

    const activeIndex = Math.max(0, images.findIndex((image) => image.id === activeImage?.id))
    const selected = images[activeIndex]
    const hasPlaceholder = selected.url.includes('/no_image')
    const allPlaceholders = images.every((image) => image.url.includes('/no_image'))
    const selectOffset = (offset: number) => {
        setActiveImage(images[(activeIndex + offset + images.length) % images.length])
    }

    return (
        <Dialog.Root open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <div className={styles.gallery}>
            <div className={`${styles.galleryMain} ${hasPlaceholder ? styles.galleryPlaceholder : ''}`}>
                <span className={styles.galleryLabel}>✦ &nbsp; THE CURATED EDIT</span>
                {hasPlaceholder ? (
                    <div className={styles.placeholderArt}>
                        <Image src="/assets/brand/gem.svg" alt="" fill priority sizes="(max-width: 767px) 90vw, 38vw" />
                        <div><span>THE ART OF FEELING EXTRAORDINARY</span><strong>{productName || 'A curated piece'}</strong><small>Product imagery coming soon</small></div>
                    </div>
                ) : (
                    <Dialog.Trigger asChild>
                    <button type="button" className={styles.zoomTrigger} aria-label="Enlarge product image">
                        <Image
                            src={selected.url}
                            alt={selected.alt || productName || 'Product image'}
                            fill
                            priority
                            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 55vw, 43vw"
                            className={styles.galleryImage}
                        />
                        <span><ZoomIn size={14} /> View detail</span>
                    </button>
                    </Dialog.Trigger>
                )}
                {images.length > 1 && !allPlaceholders && (
                    <div className={styles.galleryControls}>
                        <span>{String(activeIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</span>
                        <div>
                            <button type="button" onClick={() => selectOffset(-1)} aria-label="Previous image"><ArrowLeft size={16} /></button>
                            <button type="button" onClick={() => selectOffset(1)} aria-label="Next image"><ArrowRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>
            {images.length > 1 && !allPlaceholders && (
                <div className={styles.thumbnails} aria-label="Product images">
                    {images.map((image, index) => (
                        <button
                            type="button"
                            key={image.id}
                            aria-label={`View image ${index + 1}`}
                            aria-pressed={activeIndex === index}
                            className={styles.thumbnail}
                            onClick={() => setActiveImage(image)}
                        >
                            <Image src={image.url.includes('/no_image') ? '/assets/brand/gem.svg' : image.url} alt="" fill sizes="72px" />
                        </button>
                    ))}
                </div>
            )}
            {isZoomOpen && !hasPlaceholder && (
                <Dialog.Portal>
                <Dialog.Overlay className={styles.lightboxOverlay} />
                <Dialog.Content className={styles.lightbox} aria-describedby={undefined}>
                    <Dialog.Title className="sr-only">Enlarged product image</Dialog.Title>
                    <Dialog.Close asChild>
                    <button type="button" className={styles.lightboxClose} aria-label="Close image"><X size={22} /></button>
                    </Dialog.Close>
                    <Image src={selected.url} alt={selected.alt || productName || 'Product image'} fill sizes="100vw" />
                </Dialog.Content>
                </Dialog.Portal>
            )}
        </div>
        </Dialog.Root>
    )
}
