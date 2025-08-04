import HomeMainSwiper from "@/components/store/home/main/home-swiper";
import HomeUserCard from "@/components/store/home/main/user";
import Sideline from "@/components/store/home/sideline/sideline";
import CategoriesHeader from "@/components/store/layout/categories-header/categories-header";
import Footer from "@/components/store/layout/footer/footer";
import StoreHeader from "@/components/store/layout/header/header";
import ProductList from "@/components/store/shared/product-list";
import MainSwiper from "@/components/store/shared/swiper";
import { getHomeDataDynamic, getHomeFeaturedCategories } from "@/queries/home";
import { getProducts } from "@/queries/product";
import Link from "next/link";

export default async function HomePage() {
    const productsData = await getProducts({}, "", 1, 100);
    const { products } = productsData;
    const { data } = await getHomeDataDynamic([
        { property: "offer", value: "Seasonal", type: "full" },
        { property: "offer", value: "New Product", type: "full" },
    ]);

    console.log(data);

    const categories = await getHomeFeaturedCategories();

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
                            {/* Left */}
                            <Link href="">
                                <div
                                    className="hidden h-[555px] cursor-pointer rounded-md bg-cover bg-no-repeat min-[1465px]:block"
                                    style={{
                                        backgroundImage:
                                            "url(/assets/images/ads/winter-sports-clothing.jpg)",
                                    }}
                                />
                            </Link>
                            {/* Middle */}
                            <div className="h-fit space-y-2">
                                {/* Main swiper */}
                                <HomeMainSwiper />
                                {/* Featured card */}
                                <div className="h-[200px]"></div>
                            </div>
                            {/* Right */}
                            <div className="h-full">
                                <HomeUserCard products={data} />
                            </div>
                        </div>
                    </div>
                    {/* <MainSwiper products={data} type="main" /> */}
                </div>
            </div>
            <Footer />
        </>
    );
}
