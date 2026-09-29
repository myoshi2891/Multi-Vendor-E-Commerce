import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { ProductType } from '@/lib/types'
import styles from './product.module.css'

export default function EditorialProductGrid({
    products,
    title,
    eyebrow = 'CURATED FOR YOU',
}: {
    products: ProductType[]
    title: string
    eyebrow?: string
}) {
    if (products.length === 0) return null

    return (
        <section className={styles.recommendations}>
            <div className={styles.contentHeading}>
                <div><p>{eyebrow}</p><h2>{title}</h2></div>
                <span>DISCOVER MORE <ArrowUpRight size={14} /></span>
            </div>
            <div className={styles.recommendationGrid}>
                {products.map((product) => {
                    const variant = product.variants[0]
                    if (!variant) return null
                    const image = variant.images[0]?.url
                    const placeholder = !image || image.includes('/no_image')
                    const prices = variant.sizes.map((size) => size.price * (1 - size.discount / 100))
                    const minPrice = prices.length > 0 ? Math.min(...prices) : null
                    return (
                        <Link key={product.id} className={styles.recommendationCard} href={`/product/${product.slug}/${variant.variantSlug}`} aria-label={`${product.name} ${variant.variantName}`}>
                            <div className={`${styles.recommendationImage} ${placeholder ? styles.recommendationPlaceholder : ''}`}>
                                <Image data-testid="editorial-product-image" src={placeholder ? '/assets/brand/gem.svg' : image} alt={placeholder ? '' : `${product.name} ${variant.variantName}`} fill sizes="(max-width: 700px) 45vw, (max-width: 1200px) 30vw, 22vw" />
                                <span>VIEW THE PIECE <ArrowUpRight size={13} /></span>
                            </div>
                            <div className={styles.recommendationCopy}>
                                <p>THE CURATED COLLECTION</p>
                                <h3>{product.name}</h3>
                                <span>{variant.variantName}</span>
                                <strong>{minPrice === null ? 'Explore' : `$${minPrice.toFixed(2)}`}</strong>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
