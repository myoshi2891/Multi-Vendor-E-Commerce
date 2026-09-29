'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown, Menu } from 'lucide-react'
import styles from './product.module.css'

type NavigationItem = { name: string; url: string }

export default function ProductNavigation({
    categories,
    offers,
}: {
    categories: NavigationItem[]
    offers: NavigationItem[]
}) {
    const [open, setOpen] = useState(false)
    const root = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const close = (event: KeyboardEvent | MouseEvent) => {
            if (event instanceof KeyboardEvent && event.key === 'Escape') setOpen(false)
            if (event instanceof MouseEvent && !root.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('keydown', close)
        document.addEventListener('mousedown', close)
        return () => {
            document.removeEventListener('keydown', close)
            document.removeEventListener('mousedown', close)
        }
    }, [open])

    return (
        <nav aria-label="Explore collections" className={styles.discoveryNav}>
            <div className={styles.discoveryInner}>
                <span className={styles.discoveryLabel}>DISCOVER <span>✦</span></span>
                <div className={styles.categoryMenu} ref={root}>
                    <button type="button" aria-label="Browse categories" aria-expanded={open} aria-controls="product-category-menu" onClick={() => setOpen(!open)}>
                        <Menu size={16} /><span>Categories</span><ChevronDown size={14} />
                    </button>
                    <div id="product-category-menu" className={styles.categoryDropdown} hidden={!open}>
                        <p>EXPLORE BY CATEGORY</p>
                        {categories.map((category) => (
                            <Link key={category.url} href={`/browse?category=${encodeURIComponent(category.url)}`} onClick={() => setOpen(false)}>
                                {category.name}<ArrowUpRight size={13} />
                            </Link>
                        ))}
                    </div>
                </div>
                <div className={styles.offerRail}>
                    <Link href="/browse">The collection</Link>
                    {offers.slice(0, 7).map((offer) => (
                        <Link key={offer.url} href={`/browse?offer=${encodeURIComponent(offer.url)}`}>{offer.name}</Link>
                    ))}
                </div>
                <span className={styles.discoveryEnd}>FIND YOUR EXTRAORDINARY <ArrowUpRight size={13} /></span>
            </div>
        </nav>
    )
}
