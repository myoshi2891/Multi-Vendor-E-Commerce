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
import { products } from "./purchase-data";
import StoreProducts from "@/components/store/store-page/store-products";
import StoreDetails from "@/components/store/store-page/store-details";
import QuantitySelector from "@/components/store/product-page/quantity-selector";
import Pagination from "@/components/store/shared/pagination";
import ReviewFilters from "@/components/store/product-page/reviews/filters";
import type { ReviewsFilterType } from "@/lib/types";
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
                    <h1>Made to be yours</h1>
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
                        <Link href="/browse?category=art">Art</Link>
                    </FilterPanel>
                    <ProductList
                        products={
                            new URLSearchParams(location.search).has("pieces")
                                ? products
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
