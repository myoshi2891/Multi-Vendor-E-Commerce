import Link from "next/link";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import PurchaseHeader from "./purchase-header";
import homeStyles from "@/components/store/home/luxury/luxury.module.css";
import Experience from "@/components/store/home/luxury/experience";
import FilterPanel from "@/components/store/browse-page/filter-panel";
import ProductSort from "@/components/store/browse-page/sort";
import CartContainer from "@/components/store/cart-page/container";
import StoreToaster from "@/components/store/shared/store-toaster";
import { useCartStore } from "@/cart-store/useCartStore";
import { createMockCartProduct } from "@/config/test-fixtures";
import ProductList from "@/components/store/shared/product-list";
import { products, multiVariantProducts } from "./purchase-data";
import StoreProducts from "@/components/store/store-page/store-products";
import StoreDetails from "@/components/store/store-page/store-details";
import QuantitySelector from "@/components/store/product-page/quantity-selector";
import BrowsePagination from "@/components/store/browse-page/browse-pagination";
import Pagination from "@/components/store/shared/pagination";
import ReviewFilters from "@/components/store/product-page/reviews/filters";
import CategoryFilter from "@/components/store/browse-page/filters/category/category-filter";
import { createMockCategory } from "@/config/test-fixtures";
import ReviewDetails from "@/components/store/forms/review-details";
import ReviewCard from "@/components/store/cards/review";
import { createMockUser } from "@/config/test-fixtures";
import type { ReviewWithImageType } from "@/lib/types";
import ReviewsSort from "@/components/store/product-page/reviews/sort";
import type { ReviewsOrderType } from "@/lib/types";
import type { ReviewsFilterType } from "@/lib/types";
import ProductNavigation from "@/components/store/product-page/product-navigation";
import ProductInfo from "@/components/store/product-page/product-info/product-info";
import StoreCard from "@/components/store/cards/store-card";
import type { ProductPageDataType } from "@/lib/types";
import productStyles from "@/components/store/product-page/product.module.css";
import browseStyles from "@/app/(store)/browse/browse.module.css";
const screen = new URLSearchParams(location.search).get("screen") ?? "home";
let saveCalls = 0;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
if (screen === "cart")
    useCartStore
        .getState()
        .setCart(
            new URLSearchParams(location.search).has("empty")
                ? []
                : [
                      createMockCartProduct({
                          name: "A considered cart piece ".repeat(8),
                          image: "/assets/images/no_image.png",
                          variantImage: "/assets/images/no_image.png",
                          price: 10,
                          quantity: 1,
                          stock: 3,
                      }),
                  ]
        );
function App({ storeCollection }: { storeCollection: React.ReactNode }) {
    const [page, setPage] = useState(1);
    const [quantity, setQuantity] = useState(1);
    const [reviews, setReviews] = useState<ReviewWithImageType[]>([]);
    const [reviewSort, setReviewSort] = useState<ReviewsOrderType>();
    const [filters, setFilters] = useState<ReviewsFilterType>({});
    return (
        <>
            <PurchaseHeader />
            {screen === "cart" ? (
                <>
                    <StoreToaster />
                    <CartContainer
                        userCountry={{
                            name: "Japan",
                            code: "JP",
                            city: "",
                            region: "",
                        }}
                        syncCartAction={async (items) => {
                            await delay(150);
                            if (
                                new URLSearchParams(location.search).has(
                                    "sync-error"
                                )
                            )
                                throw new Error("Fixture sync failure");
                            return items;
                        }}
                        saveCartAction={async () => {
                            saveCalls++;
                            await delay(600);
                            if (saveCalls === 1)
                                throw new Error("Fixture save failure");
                            return true;
                        }}
                        wishlistAction={async () => true}
                    />
                </>
            ) : screen === "home" ? (
                <main className={homeStyles.home}>
                    <Experience categories={[]} />
                </main>
            ) : screen === "store" ? (
                <main className={browseStyles.browse}>
                    <StoreDetails
                        details={{
                            id: "store",
                            name: "A considered store ".repeat(8),
                            description: "A long description ".repeat(30),
                            logo: "/assets/images/no_image.png",
                            cover: "/assets/images/no_image.png",
                            averageRating: 4.5,
                            numReviews: 12,
                        }}
                    />
                    <section id="collection" className={browseStyles.catalog}>
                        {storeCollection}
                    </section>
                </main>
            ) : screen === "product" ? (
                <main className={productStyles.page}>
                    {new URLSearchParams(location.search).has("audit") ? <>
                        <StoreToaster />
                        <ProductNavigation categories={[{name: "Art", url: "art"}]} offers={[]} />
                        <div className={productStyles.productBody}>
                            <ProductInfo productData={{name: "Considered piece", sku: "SKU-001", colors: [{name: "Ivory"}], variantInfo: [], sizes: [], isSale: false, variantName: "Ivory", variantDescription: "A thoughtful piece.", variantId: "variant", variantSlug: "ivory", productSlug: "considered-piece", images: [{url: "/assets/brand/star.svg"}], store: {name: "The boutique", url: "boutique", logo: "/assets/brand/star.svg"}, rating: 4.5, reviewsStatistics: {totalReviews: 3, ratingStatistics: []}} as unknown as ProductPageDataType} sizeId={undefined} handleChange={() => {}} setVariantImages={() => {}} setActiveImage={() => {}} />
                        </div>
                        <StoreCard editorial store={{id: "store", name: "The boutique", url: "boutique", logo: "/assets/brand/star.svg", followersCount: 3, isUserFollowingStore: false}} />
                    </> : <h1>Made to be yours</h1>}
                    <QuantitySelector
                        productId="product"
                        variantId="variant"
                        sizeId={
                            new URLSearchParams(location.search).has("no-size")
                                ? null
                                : "size"
                        }
                        quantity={quantity}
                        stock={3}
                        handleChange={(key, value) => {
                            if (key === "quantity") setQuantity(Number(value));
                        }}
                    />
                    <section className={productStyles.belowFold}>
                        <ReviewFilters
                            filters={filters}
                            setFilters={setFilters}
                            setSort={() => {}}
                            stats={{
                                totalReviews: 3,
                                reviewsWithImagesCount: 1,
                                ratingStatistics: [
                                    {
                                        rating: 5,
                                        numReviews: 3,
                                        percentage: 100,
                                    },
                                ],
                            }}
                        />
                        {new URLSearchParams(location.search).has("review-form") && <>
                            <ReviewCard editorial review={{ id: "review", productId: "product", userId: "user", createdAt: new Date(), updatedAt: new Date(), rating: 4.5, likes: 0, review: "A thoughtful piece ".repeat(30), variant: "Ivory", size: "M", quantity: "1", color: "ivory", images: [], user: createMockUser({ picture: "/assets/images/default-user.jpg" }) }} />
                            <ReviewDetails productId="product" variantsInfo={[{ ...products[0].variants[0], variantImage: "/assets/brand/star.svg", variantUrl: "/product/considered-piece/ivory", colors: [{ name: "ivory" }] }]} reviews={reviews} setReviews={setReviews} />
                        </>}
                        <ReviewsSort sort={reviewSort} setSort={setReviewSort} />
                        <Pagination
                            variant="editorial"
                            page={page}
                            totalPages={3}
                            setPage={setPage}
                        />
                    </section>
                </main>
            ) : (
                <main className={browseStyles.browse}>
                    <h1>The collection</h1>
                    <ProductSort />
                    <FilterPanel>
                        <CategoryFilter categories={[{ ...createMockCategory({ name: "Art", url: "art" }), children: [] }]} />
                    </FilterPanel>
                    <BrowsePagination page={Number(new URLSearchParams(location.search).get("page") ?? 1)} totalPages={3} />
                    <ProductList
                        products={
                            new URLSearchParams(location.search).has("pieces")
                                ? (new URLSearchParams(location.search).has("variants") ? multiVariantProducts : products)
                                : []
                        }
                        variant="editorial"
                    />
                </main>
            )}
        </>
    );
}
StoreProducts({
    searchParams: {} as Parameters<typeof StoreProducts>[0]["searchParams"],
    store: "fixture",
}).then((storeCollection) => {
    createRoot(document.getElementById("root")!).render(
        <App storeCollection={storeCollection} />
    );
});
