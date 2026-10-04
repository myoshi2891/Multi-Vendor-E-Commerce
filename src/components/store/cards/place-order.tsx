import { useCartStore } from "@/cart-store/useCartStore";
import type { CheckoutActions } from "@/lib/commerce-actions";
import styles from "../shared/commerce.module.css";
import type { ShippingAddress } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Dispatch, FC, SetStateAction, useRef, useState } from "react";
import toast from "react-hot-toast";
import { SecurityPrivacyCard } from "../product-page/returns-security-privacy-card";

import FastDelivery from "./fast-delivery";

import { logError } from "@/lib/log";
import { SerializedCartType } from "@/lib/types";
import ApplyCouponForm from "../forms/apply-coupon";

interface Props {
    actions: CheckoutActions;
    disabled?: boolean;
    onBusyChange: (busy: boolean) => void;
    shippingAddress: ShippingAddress | null;
    cartData: SerializedCartType;
    setCartData: Dispatch<SetStateAction<SerializedCartType>>;
}

const PlaceOrderCard: FC<Props> = ({
    shippingAddress,
    setCartData,
    cartData,
    actions,
    disabled = false,
    onBusyChange,
}) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState(false);
    const isPlacingOrderRef = useRef(false);
    const { id, coupon, subTotal, shippingFees, total } = cartData;
    const { push } = useRouter();
    const emptyCart = useCartStore((state) => state.emptyCart);
    const handlePlaceOrder = async () => {
        if (isPlacingOrderRef.current || disabled) return;
        isPlacingOrderRef.current = true;
        setLoading(true);
        onBusyChange(true);
        setError(false);
        // push() は戻り値が void で await できず、遷移完了まで本コンポーネントは
        // マウントされたままになる。注文成立後にガードを解除すると遷移中にボタンが
        // 再有効化され、カート削除済みの状態で placeOrder が再実行されてしまう
        // （"Cart not found." で失敗し、成功したのに誤エラーが表示される）。
        let orderPlaced = false;
        try {
            if (!shippingAddress) {
                toast.error(
                    "Select a shipping address before placing your order."
                );
                return;
            }
            const order = await actions.placeOrderAction(shippingAddress, id);
            if (order) {
                // 注文成立は不可逆。この時点でガードを恒久化し、以降の後片付けが
                // 失敗しても再注文させない。
                orderPlaced = true;
                try {
                    // emptyCart は同期関数だが、persist ミドルウェアが
                    // localStorage へ書き出すため storage 失敗で throw しうる。
                    // 無保護だと成立済みの注文が遷移できず復帰不能になる。
                    emptyCart();
                } catch (error: unknown) {
                    logError(
                        "[PlaceOrder:handlePlaceOrder] local cart clear failed",
                        error
                    );
                }
                try {
                    await actions.emptyCartAction();
                } catch (error: unknown) {
                    // カートの後片付け失敗は注文成立を取り消さないため、
                    // ログのみに留めて遷移を継続する。
                    logError(
                        "[PlaceOrder:handlePlaceOrder] cart cleanup failed",
                        error
                    );
                }
                push(`/order/${order.orderId}`);
            }
        } catch (error: unknown) {
            setError(true);
            logError(
                "[PlaceOrder:handlePlaceOrder] failed to place order",
                error
            );
            toast.error("Something went wrong while placing your order.");
        } finally {
            // 注文成立後は解除しない（アンマウント前提の意図的な例外）。
            // 失敗・住所未選択時のみ解除して再試行を許可する。
            if (!orderPlaced) {
                isPlacingOrderRef.current = false;
                setLoading(false);
                onBusyChange(false);
            }
        }
    };

    let discountedAmount = 0;
    const isPlatformCoupon = coupon?.scope === "PLATFORM";
    const applicableStoreItems = isPlatformCoupon
        ? cartData.cartItems
        : cartData.cartItems.filter((item) => item.storeId === coupon?.storeId);

    const storeSubTotal = applicableStoreItems.reduce(
        (acc, item) =>
            acc + Number(item.price) * item.quantity + Number(item.shippingFee),
        0
    );

    if (coupon) {
        discountedAmount = (storeSubTotal * coupon.discount) / 100;
    }

    return (
        <aside className={styles.aside} aria-label="Checkout summary">
            <section className={styles.summary}>
                <h2>Summary</h2>
                <dl>
                    <Info title="Subtotal" text={subTotal.toFixed(2)} />
                    <Info
                        title="Shipping Fees"
                        text={`+${shippingFees.toFixed(2)}`}
                    />
                    {coupon && (
                        <Info
                            title={`Coupon (${coupon.code}) (-${coupon.discount}%)`}
                            text={`-$${discountedAmount.toFixed(2)}`}
                        />
                    )}
                    <Info title="Taxes" text="+0.00" />
                    <Info title="Total" text={total.toFixed(2)} isBold />
                </dl>
                <button
                    className={styles.primary}
                    onClick={handlePlaceOrder}
                    disabled={disabled || loading}
                >
                    {loading ? "Placing order…" : "Place order"}
                </button>
                {!shippingAddress && (
                    <p className={styles.note}>
                        Select a shipping address before placing your order.
                    </p>
                )}
                {loading && (
                    <p role="status" className={styles.note}>
                        Placing your order…
                    </p>
                )}
            </section>
            {error && (
                <p className={styles.error} role="alert">
                    We couldn’t place your order. Please try again.
                </p>
            )}
            <section className={styles.panel} aria-label="Coupon">
                {coupon ? (
                    <>
                        <h2>Coupon applied !</h2>
                        <p className={styles.note}>
                            ({coupon.code}) ({coupon.discount}% off) —{" "}
                            {coupon.store?.name ?? "全店舗"}
                        </p>
                    </>
                ) : (
                    <ApplyCouponForm
                        cartId={id}
                        setCartData={setCartData}
                        applyCouponAction={actions.applyCouponAction}
                        disabled={disabled || loading}
                        onBusyChange={onBusyChange}
                    />
                )}
            </section>
            <div className={styles.assurance}>
                <FastDelivery editorial />
            </div>
            <div className={styles.assurance}>
                <SecurityPrivacyCard editorial />
            </div>
        </aside>
    );
};
export default PlaceOrderCard;
const Info = ({
    title,
    text,
    isBold,
}: {
    title: string;
    text: string;
    isBold?: boolean;
}) => (
    <div className={`${styles.row} ${isBold ? styles.total : ""}`}>
        <dt>{title}</dt>
        <dd>{text}</dd>
    </div>
);
