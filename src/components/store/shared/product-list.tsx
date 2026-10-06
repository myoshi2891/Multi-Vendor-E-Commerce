import { ProductType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { FC } from 'react'
import ProductCard from '../cards/product/product-card'
import ReactStars from 'react-rating-stars-component'

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
        <div className="relative" data-variant={variant}>
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
                        <ProductCard key={product.id} product={product} variant={variant} />
                    ))}
                </div>
            ) : variant === 'editorial' ? (
                <div className="min-h-64 border border-[#c9c8bb] px-6 py-16 text-center">
                    <p className="font-serif text-2xl text-[#17251d]">No pieces found in this edit.</p>
                    <p className="mt-3 text-sm text-[#536054]">Try another filter or explore the full collection.</p>
                    <Link href="/browse" className="mt-7 inline-block border-b border-[#a68a56] pb-1 text-xs uppercase tracking-widest text-[#766541]">
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
