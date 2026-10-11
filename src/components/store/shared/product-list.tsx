import { ProductType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { FC } from 'react'
import ProductCard from '../cards/product/product-card'
import ReactStars from 'react-rating-stars-component'
import styles from './product-list.module.css'

interface Props {
    products: ProductType[] // Array of products data
    title?: string
    link?: string
    arrow?: boolean
    variant?: 'editorial'
}

const ProductList: FC<Props> = ({ products, title, link, arrow, variant }) => {
    const renderTitle = () => {
        if (link) {
            return (
                <Link href={link} className="h-12">
                    <h2 className="text-xl font-bold text-main-primary">
                        {title}&nbsp;
                        {arrow && <ChevronRight className="inline-block w-3" />}
                    </h2>
                </Link>
            )
        } else {
            return (
                <h2 className="text-xl font-bold text-main-primary">
                    {title}&nbsp;
                    {arrow && <ChevronRight className="inline-block w-3" />}
                </h2>
            )
        }
    }
    return (
        <div className={cn("relative", variant === 'editorial' && styles.editorial)} data-variant={variant}>
            {title && renderTitle()}
            {/* 絞り込み結果の告知用。新規マウントされた空状態は読み上げられないため常設ノードの文言を更新する */}
            {variant === 'editorial' && (
                <p role="status" className="sr-only">
                    {products.length === 0 ? 'No pieces match these filters.' : ''}
                </p>
            )}
            {products.length > 0 ? (
                <div
                    className={cn(
                        variant === 'editorial'
                            ? 'grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3 xl:grid-cols-4'
                            : 'flex w-[calc(100%+3rem)] -translate-x-5 flex-wrap sm:w-[calc(100%+1.5rem)]',
                        {
                            'mt-2': title,
                        }
                    )}
                >
                    {products.map((product) => (
                        // 閲覧履歴はバリアント単位で、同一商品が複数枚並ぶため先頭バリアントも key に含める
                        <ProductCard key={`${product.id}:${product.variants[0]?.variantId ?? ''}`} product={product} variant={variant} />
                    ))}
                </div>
            ) : variant === 'editorial' ? (
                <div className={styles.empty}>
                    <p>No pieces found in this edit.</p>
                    <p>Try another filter or explore the full collection.</p>
                    <Link href="/browse">
                        Explore all pieces
                    </Link>
                </div>
            ) : (
                'No Products'
            )}
        </div>
    )
}

export default ProductList
