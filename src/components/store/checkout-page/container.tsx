"use client";
import {
    SerializedCartType,
    Country as CountryType,
    UserShippingAddressType,
} from "@/lib/types";
import { Country, ShippingAddress } from "@prisma/client";
import { FC, useEffect, useRef, useState } from "react";
import UserShippingAddresses from "../shared/shipping-addresses/shipping-addresses";
import CheckoutProductCard from "../cards/checkout-product";
import PlaceOrderCard from "../cards/place-order";
import CountryNote from "../shared/country-note";
import type { CheckoutActions } from "@/lib/commerce-actions";
import styles from "../shared/commerce.module.css";
import Link from "next/link";
import { isCouponCurrentlyValid } from "@/lib/coupon-utils";
import toast from "react-hot-toast";

interface Props {
    actions: CheckoutActions;
    cart: SerializedCartType;
    countries: Country[];
    addresses: UserShippingAddressType[];
    userCountry: CountryType;
}

const CheckoutContainer: FC<Props> = ({
    cart,
    countries,
    addresses,
    userCountry,
    actions,
}) => {
    const [pending, setPending] = useState(cart.cartItems.length > 0);
    const [failed, setFailed] = useState(false);
    const [retry, setRetry] = useState(0);
    const [busy, setBusy] = useState(false);
    const [cartData, setCartData] = useState<SerializedCartType>(cart);

    // 引き直しリクエストの直列化キュー。
    // `updateCheckoutProductWithLatest` は表示値を返すだけでなく CartItem / Cart を
    // **DB へ書き込む**ため、`cancelled` フラグでは守れない。あれが止められるのは
    // クライアント state の上書きだけで、既にサーバーへ着いた書き込みは取り消せない。
    // 住所を素早く切り替えて 2 本が並行すると、古い国のリクエストが後着した場合に
    // 送料・合計が古い国の値で確定し、画面表示（新しい国）と DB が食い違う。
    // 呼び出し順で直列化し、常に最新の activeCountry の書き込みが最後に来ることを保証する。
    const hydrateQueueRef = useRef<Promise<void>>(Promise.resolve());

    const [selectedAddress, setSelectedAddress] =
        useState<ShippingAddress | null>(
            addresses.find((address) => address.default) ?? null
        );

    const activeCountry = countries.find(
        (country) => country.id === selectedAddress?.countryId
    );

    const { cartItems } = cart;

    useEffect(() => {
        let cancelled = false;

        const hydrateCheckoutCart = async () => {
            try {
                const updatedCart = await actions.refreshCartAction(
                    cartItems,
                    activeCountry
                );
                // アンマウント後 or 国が切り替わった後は、古いレスポンスで上書きしない
                if (!cancelled) {
                    setCartData(updatedCart);
                    setFailed(false);
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[CheckoutContainer:hydrateCheckoutCart] Failed to refresh checkout cart",
                        { error: error.message, stack: error.stack }
                    );
                } else {
                    console.error(
                        "[CheckoutContainer:hydrateCheckoutCart] Unknown error",
                        { error }
                    );
                }
                // 握りつぶさない: 失敗を伝えないと、古い金額のまま注文を確定できてしまう
                if (!cancelled) {
                    setFailed(true);
                    toast.error("Failed to refresh checkout details.");
                }
            } finally {
                if (!cancelled) setPending(false);
            }
        };
        if (cartItems.length > 0) {
            setPending(true);
            setFailed(false);
            // 前の引き直しが決着してから次を投げる。`hydrateCheckoutCart` は内部で
            // 例外を捕まえるので reject しないが、キューが二度と流れなくなる事態を
            // 避けるため保険の catch を付ける。
            hydrateQueueRef.current = hydrateQueueRef.current
                .then(hydrateCheckoutCart)
                .catch(() => {});
        }

        return () => {
            cancelled = true;
        };
        // The country object is stable between renders; the queue preserves DB write order.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCountry, retry]);

    return (
        <div className={styles.layout} data-checkout>
            <div className={styles.column}>
                <UserShippingAddresses
                    addresses={addresses}
                    countries={countries}
                    selectedAddress={selectedAddress}
                    setSelectedAddress={setSelectedAddress}
                    actions={actions}
                    disabled={busy}
                    onBusyChange={setBusy}
                />
                <CountryNote
                    country={activeCountry?.name ?? userCountry.name}
                    editorial
                />
                {pending && (
                    <p role="status" className={styles.status}>
                        Updating checkout details…
                    </p>
                )}
                {failed && (
                    <div role="alert" className={styles.error}>
                        <p>
                            We couldn’t refresh checkout details. Please retry
                            before placing an order.
                        </p>
                        <button
                            className={styles.secondary}
                            onClick={() => setRetry((value) => value + 1)}
                            disabled={busy}
                        >
                            Retry checkout
                        </button>
                    </div>
                )}
                <section
                    className={styles.panel}
                    aria-labelledby="checkout-items"
                >
                    <h2 id="checkout-items">Your items</h2>
                    {cartData.cartItems.length ? (
                        cartData.cartItems.map((product) => (
                            <CheckoutProductCard
                                key={product.id}
                                product={product}
                                isDiscounted={
                                    cartData.coupon !== null &&
                                    isCouponCurrentlyValid(cartData.coupon) &&
                                    (cartData.coupon.scope === "PLATFORM" ||
                                        cartData.coupon.storeId ===
                                            product.storeId)
                                }
                            />
                        ))
                    ) : (
                        <>
                            <p className={styles.note}>Your bag is empty.</p>
                            <Link className={styles.secondary} href="/browse">
                                Explore the collection
                            </Link>
                        </>
                    )}
                </section>
            </div>
            <PlaceOrderCard
                cartData={cartData}
                setCartData={setCartData}
                shippingAddress={selectedAddress}
                actions={actions}
                disabled={
                    pending || failed || busy || cartData.cartItems.length === 0
                }
                onBusyChange={setBusy}
            />
        </div>
    );
};
export default CheckoutContainer;
