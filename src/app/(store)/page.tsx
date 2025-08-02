import Sideline from "@/components/store/home/sideline/sideline";
import CategoriesHeader from "@/components/store/layout/categories-header/categories-header";
import Footer from "@/components/store/layout/footer/footer";
import StoreHeader from "@/components/store/layout/header/header";
import ProductList from "@/components/store/shared/product-list";
import { getHomeDataDynamic, getHomeFeaturedCategories } from "@/queries/home";
import { getProducts } from "@/queries/product";

export default async function HomePage() {
    const productsData = await getProducts();
    const { products } = productsData;

    const { data } = await getHomeDataDynamic([
        { property: "offer", value: "Seasonal", type: "full" },
    ]);

    const categories = await getHomeFeaturedCategories();

    return (
        <>
            <StoreHeader />
            <CategoriesHeader />
            <div className="relative min-h-screen w-full">
                <Sideline />
            </div>
            <Footer />
        </>
    );
}
