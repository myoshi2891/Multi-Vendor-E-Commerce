import AnimatedDeals from "@/components/store/home/animated-deals";
import Featured from "@/components/store/home/main/featured";
import HomeMainSwiper from "@/components/store/home/main/home-swiper";
import HomeUserCard from "@/components/store/home/main/user/user";
import Sideline from "@/components/store/home/sideline/sideline";
import CategoriesHeader from "@/components/store/layout/categories-header/categories-header";
import Footer from "@/components/store/layout/footer/footer";
import StoreHeader from "@/components/store/layout/header/header";
import ProductList from "@/components/store/shared/product-list";
import MainSwiper from "@/components/store/shared/swiper";
import { SimpleProduct } from "@/lib/types";
import { getHomeDataDynamic, getHomeFeaturedCategories } from "@/queries/home";
import { getProducts } from "@/queries/product";
import Image from "next/image";
import Link from "next/link";
import SuperDealsImg from "@/public/assets/images/ads/super-deals.avif";
import FeaturedCategories from "@/components/store/home/featured-categories";
import ProductCard from "@/components/store/cards/product/product-card";

export default async function HomePage() {
    const productsData = await getProducts({}, "", 1, 100);
    const { products } = productsData;
    const { products_new_product, products_seasonal } =
        await getHomeDataDynamic([
            {
                property: "offer",
                value: "new-product",
                type: "simple",
            },
            { property: "offer", value: "seasonal", type: "full" },
        ]);

    const featuredCategories = await getHomeFeaturedCategories();

    return (
        <>
            <StoreHeader />
            <CategoriesHeader />
            <div className="relative min-h-screen w-full">
                <Sideline />
                <div className="relative h-full w-[calc(100%-40px)] bg-[#e3e3e3]">
                    <div className="mx-auto min-h-screen max-w-[1600px] p-4">
                        {/* Main */}
                        <div className="grid w-full gap-2 min-[1170px]:grid-cols-[1fr_350px] min-[1465px]:grid-cols-[200px_1fr_350px]">
                            {/* Left */}{" "}
                            <div
                                className="hidden cursor-pointer rounded-md bg-cover bg-no-repeat min-[1465px]:block"
                                style={{
                                    backgroundImage:
                                        "url(/assets/images/ads/winter-sports-clothing.jpg)",
                                }}
                            />
                            {/* Middle */}
                            <div className="h-fit space-y-2">
                                {/* Main swiper */}
                                <HomeMainSwiper />
                                {/* Featured card */}
                                <Featured
                                    products={products_new_product.filter(
                                        (product): product is SimpleProduct =>
                                            "variantSlug" in product
                                    )}
                                />
                            </div>
                            {/* Right */}
                            <div className="h-full">
                                <HomeUserCard
                                    products={products_new_product.filter(
                                        (product): product is SimpleProduct =>
                                            "variantSlug" in product
                                    )}
                                />
                            </div>
                        </div>
                        {/* Animated deals */}
                        <div className="mt-2 hidden min-[915px]:block">
                            <AnimatedDeals
                                products={products_new_product.filter(
                                    (product): product is SimpleProduct =>
                                        "variantSlug" in product
                                )}
                            />
                        </div>
                        <div className="mt-10 space-y-10">
                            <div className="rounded-md bg-white">
                                <MainSwiper
                                    products={products_seasonal}
                                    type="curved"
                                >
                                    <div className="mb-4 flex items-center justify-between pl-4">
                                        <Image
                                            src={SuperDealsImg}
                                            alt="Super Deals"
                                            width={200}
                                            height={50}
                                            priority
                                        />
                                    </div>
                                </MainSwiper>
                            </div>
                            <FeaturedCategories
                                categories={featuredCategories}
                            />
                            <div>
                                {/* Header */}
                                <div className="flex h-8 justify-center text-center text-[24px] font-extrabold leading-8 text-[#222]">
                                    <div className="mx-[14px] my-4 h-px flex-1 border-t-2 border-t-[hsla(0,0%,59.2%,.3)]" />
                                    <span>More to love</span>
                                    <div className="mx-[14px] my-4 h-px flex-1 border-t-2 border-t-[hsla(0,0%,59.2%,.3)]" />
                                </div>
                                <div className="mt-7 flex flex-wrap justify-center rounded-md bg-white p-4 pb-16 min-[1530px]:grid min-[1530px]:grid-cols-7">
                                    {products.map((product, i) => (
                                        <ProductCard
                                            key={i}
                                            product={product}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* <MainSwiper products={products_new_product} type="main" /> */}
                </div>
            </div>
            <Footer />
        </>
    );
}
