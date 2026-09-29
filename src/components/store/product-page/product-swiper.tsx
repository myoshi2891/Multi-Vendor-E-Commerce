'use client'

import Image from 'next/image'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
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
    useEffect(() => {
        if (!isZoomOpen) return
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsZoomOpen(false)
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [isZoomOpen])
    if (!images?.length) return null

    const activeIndex = Math.max(0, images.findIndex((image) => image.id === activeImage?.id))
    const selected = images[activeIndex]
    const hasPlaceholder = selected.url.includes('/no_image')
    const allPlaceholders = images.every((image) => image.url.includes('/no_image'))
    const selectOffset = (offset: number) => {
        setActiveImage(images[(activeIndex + offset + images.length) % images.length])
    }

    return (
        <div className={styles.gallery}>
            <div className={`${styles.galleryMain} ${hasPlaceholder ? styles.galleryPlaceholder : ''}`}>
                <span className={styles.galleryLabel}>✦ &nbsp; THE CURATED EDIT</span>
                {hasPlaceholder ? (
                    <div className={styles.placeholderArt}>
                        <Image src="/assets/brand/gem.svg" alt="" fill priority sizes="(max-width: 767px) 90vw, 38vw" />
                        <div><span>THE ART OF FEELING EXTRAORDINARY</span><strong>{productName || 'A curated piece'}</strong><small>Product imagery coming soon</small></div>
                    </div>
                ) : (
                    <button type="button" className={styles.zoomTrigger} onClick={() => setIsZoomOpen(true)} aria-label="Enlarge product image">
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
                // fill 画像がダイアログ全面を覆うため背景クリックは到達しない。閉じる操作は Close ボタンと Escape キーに集約する
                <dialog open className={styles.lightbox} aria-modal="true" aria-label="Enlarged product image">
                    <button type="button" className={styles.lightboxClose} onClick={() => setIsZoomOpen(false)} aria-label="Close image"><X size={22} /></button>
                    <Image src={selected.url} alt={selected.alt || productName || 'Product image'} fill sizes="100vw" />
                </dialog>
            )}
        </div>
    )
}
