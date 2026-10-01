"use client";
import { useCartStore } from "@/cart-store/useCartStore";
import useFromStore from "@/hooks/useFromStore";
import { CartProductType, Country } from "@/lib/types";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import CartHeader from "./cart-header";
import CartProduct from "../cards/cart-product";
import { Info, Package, ShieldCheck } from "lucide-react";
import Link from "next/link";
import CartHero from "./hero";
import styles from "./cart.module.css";
import EmptyCart from "./empty-cart";
import CartSummary from "./summary";

export default function CartContainer({
    userCountry,
    syncCartAction,
    saveCartAction,
    wishlistAction,
}: {
    userCountry: Country;
    syncCartAction: (items: CartProductType[]) => Promise<CartProductType[]>;
    saveCartAction: (items: CartProductType[]) => Promise<boolean>;
    wishlistAction: (
        productId: string,
        variantId: string,
        sizeId?: string
    ) => Promise<unknown>;
}) {
    const cartItems = useFromStore(useCartStore, (state) => state.cart);
    const setCart = useCartStore((state) => state.setCart);

    const [syncError, setSyncError] = useState(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [isCartLoaded, setIsCartLoaded] = useState<boolean>(false);
    const [selectedItems, setSelectedItems] = useState<CartProductType[]>([]);
    const [totalShipping, setTotalShipping] = useState<number>(0);

    useEffect(() => {
        if (cartItems !== undefined) {
            setIsCartLoaded(true); // Flag indicating cartItems has finished loading
        }
    }, [cartItems]);

    useEffect(() => {
        const loadAndSyncCart = async () => {
            if (cartItems?.length) {
                try {
                    const updatedCart = await syncCartAction(cartItems);

                    // サーバーは DB から消えた明細を除外して返す。黙って消えると
                    // 理由が分からないため、件数が減ったときだけ通知する。
                    if (updatedCart.length < cartItems.length) {
                        toast.error(
                            "Some items are no longer available and were removed from your cart."
                        );
                    }

                    setCart(updatedCart);
                    // 再同期に成功したら過去の失敗アラートを消す
                    setSyncError(false);
                    setLoading(false);
                } catch (error) {
                    // Handle error
                    console.error("Failed to sync cart", error);
                    setSyncError(true);
                    toast.error(
                        "We couldn’t refresh your bag. Please try again before checkout."
                    );
                    setLoading(false);
                }
            }
        };
        void loadAndSyncCart();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCartLoaded, userCountry]);

    const isCartLoading =
        cartItems === undefined || (cartItems.length > 0 && loading);

    return (
        <main className={styles.page}>
            <CartHero />
            {isCartLoading && (
                <output className={styles.loading}>
                    Loading your shopping bag…
                </output>
            )}
            {!isCartLoading && cartItems.length === 0 && <EmptyCart />}
            {!isCartLoading && cartItems.length > 0 && (
                <div className={styles.layout}>
                    <section
                        className={styles.items}
                        aria-label="Cart products"
                    >
                        <CartHeader
                            cartItems={cartItems}
                            selectedItems={selectedItems.filter((selected) =>
                                cartItems.some(
                                    (item) =>
                                        item.productId === selected.productId &&
                                        item.variantId === selected.variantId &&
                                        item.sizeId === selected.sizeId
                                )
                            )}
                            setSelectedItems={setSelectedItems}
                        />
                        <div
                            className={styles.country}
                            data-testid="country-note"
                        >
                            <Info size={16} aria-hidden="true" />
                            <p>
                                Shipping fees are calculated based on your
                                current country ({userCountry.name}). Shipping
                                fees will always automatically update to reflect
                                your delivery destination.
                            </p>
                        </div>
                        {syncError && (
                            <p role="alert" className={styles.error}>
                                We couldn’t refresh your bag. Prices and
                                availability may have changed.{" "}
                                <button
                                    className={styles.textButton}
                                    onClick={() => window.location.reload()}
                                >
                                    Refresh bag
                                </button>
                            </p>
                        )}
                        {cartItems.map((product) => (
                            <CartProduct
                                key={`${product.productId}-${product.variantId}-${product.sizeId}`}
                                product={product}
                                selectedItems={selectedItems}
                                setSelectedItems={setSelectedItems}
                                setTotalShipping={setTotalShipping}
                                userCountry={userCountry}
                                wishlistAction={wishlistAction}
                            />
                        ))}
                    </section>
                    <aside className={styles.aside} aria-label="Order summary">
                        <CartSummary
                            cartItems={cartItems}
                            shippingFees={totalShipping}
                            saveCartAction={saveCartAction}
                        />
                        <div className={styles.assurance}>
                            <Package size={18} aria-hidden="true" />
                            <div>
                                <h3>Fast Delivery</h3>
                                <p>
                                    $5.00 coupon code if delayed
                                    <br />
                                    Refund if package lost
                                    <br />
                                    Refund if no delivery in time
                                </p>
                            </div>
                        </div>
                        <div className={styles.assurance}>
                            <ShieldCheck size={18} aria-hidden="true" />
                            <div>
                                <h3>Security &amp; Privacy</h3>
                                <p>
                                    We value your privacy and security. We use
                                    secure payment methods and follow industry
                                    best practices. Review our{" "}
                                    <Link href="/legal">
                                        Privacy Policy and Terms of Service
                                    </Link>
                                    .
                                </p>
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </main>
    );
}
