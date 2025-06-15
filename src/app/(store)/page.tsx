import CategoriesHeader from '@/components/store/layout/categories-header/categories-header'
import StoreHeader from '@/components/store/layout/header/header'
import ProductList from '@/components/store/shared/product-list'
import { getProducts } from '@/queries/product'

export default async function HomePage() {
    const productsData = await getProducts()
    const { products } = productsData

    return (
        <div>
            <StoreHeader />
            <CategoriesHeader />
            <div className="p-14">
                <ProductList products={products} title="Products" arrow />
            </div>
        </div>
    )
}
