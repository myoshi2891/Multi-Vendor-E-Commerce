import { useCartStore } from '@/cart-store/useCartStore'
import ThemeToggle from '@/components/shared/theme-toggle'
import ProductList from '@/components/store/shared/product-list'
import useFromStore from '@/hooks/useFromStore'
import { getProducts } from '@/queries/product'
import { UserButton } from '@clerk/nextjs'

export default async function HomePage() {
    const productsData = await getProducts()
    const { products } = productsData
    const cart = useFromStore(useCartStore, (state) => state.cart)
    const addToCart = useCartStore((state) => state.addToCart)

    return (
        <div className="p-14">
            <ProductList products={products} title="Products" arrow />
        </div>
    )
}
