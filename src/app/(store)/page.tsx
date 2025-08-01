import CategoriesHeader from '@/components/store/layout/categories-header/categories-header'
import StoreHeader from '@/components/store/layout/header/header'
import ProductList from '@/components/store/shared/product-list'
import { getHomeDataDynamic } from "@/queries/home";
import { getProducts } from "@/queries/product";

export default async function HomePage() {
    const productsData = await getProducts();
    const { products } = productsData;

    const { products_Seasonal } = await getHomeDataDynamic([
        { property: "offer", value: "Seasonal", type: "full" },
    ]);

    console.log(products_Seasonal);

    return (
        <div>
            <StoreHeader />
            <CategoriesHeader />
            <div className="p-14">
                <ProductList
                    products={products_Seasonal}
                    title="Products"
                    arrow
                />
            </div>
        </div>
    );
}
