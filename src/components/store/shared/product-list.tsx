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
}

const ProductList: FC<Props> = ({ products, title, link, arrow }) => {
    const Title = () => {
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
        <div className="relative">
            {title && <Title />}
            {products.length > 0 ? (
                <div
                    className={cn(
                        'flex w-[calc(100%+3rem)] -translate-x-5 flex-wrap sm:w-[calc(100%+1.5rem)]',
                        {
                            'mt-2': title,
                        }
                    )}
                >
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                'No Products'
            )}
        </div>
    )
}

export default ProductList
