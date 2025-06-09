import { useCartStore } from '@/cart-store/useCartStore'
import ProductList from '@/components/store/shared/product-list'
import useFromStore from '@/hooks/useFromStore'
import { getProducts } from '@/queries/product'

export default async function HomePage() {
    const productsData = await getProducts()
    const { products } = productsData
    // const cart = useFromStore(useCartStore, (state) => state.cart)
    // const addToCart = useCartStore((state) => state.addToCart)

    return (
        <div className="p-14">
            <ProductList products={products} title="Products" arrow />
        </div>
    )
}
