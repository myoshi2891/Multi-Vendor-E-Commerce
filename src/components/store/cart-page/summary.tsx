import { CartProductType } from "@/lib/types";
import { FC, useState } from "react";
import styles from "./cart.module.css";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import { ArrowRight } from "lucide-react";

interface Props {
    cartItems: CartProductType[];
    shippingFees: number;
    saveCartAction: (items: CartProductType[]) => Promise<boolean>;
}

const CartSummary: FC<Props> = ({
    cartItems,
    shippingFees,
    saveCartAction,
}) => {
    const router = useRouter();
    const [loading, setLoading] = useState<boolean>(false);
    // Calculate subTotal from cartItems
    const subTotal = cartItems.reduce((total, item) => {
        return total + item.price * item.quantity;
    }, 0);

    // Calculate total price including shipping fees
    const total = subTotal + shippingFees;

    const handleSaveCart = async () => {
        if (loading) return;
        try {
            setLoading(true);
            const res = await saveCartAction(cartItems);
            if (res) router.push("/checkout");
        } catch (error: any) {
            // Handle error
            toast.error(error.toString());
        } finally {
            setLoading(false);
        }
    };

    return (
        <section
            className={styles.summary}
            aria-labelledby="cart-summary-heading"
        >
            <h2 id="cart-summary-heading">Summary</h2>
            <dl>
                <div className={styles.summaryRow}>
                    <dt>Subtotal</dt>
                    <dd>${subTotal.toFixed(2)}</dd>
                </div>
                <div className={styles.summaryRow}>
                    <dt>Shipping Fees</dt>
                    <dd>+${shippingFees.toFixed(2)}</dd>
                </div>
                <div className={styles.summaryRow}>
                    <dt>Taxes</dt>
                    <dd>+$0.00</dd>
                </div>
                <div className={`${styles.summaryRow} ${styles.total}`}>
                    <dt>Total</dt>
                    <dd data-testid="cart-total">${total.toFixed(2)}</dd>
                </div>
            </dl>
            <button
                type="button"
                className={styles.primary}
                onClick={handleSaveCart}
                disabled={loading}
                aria-busy={loading}
                data-testid="checkout"
            >
                {loading ? (
                    <span role="status">Preparing checkout…</span>
                ) : (
                    <>
                        Checkout ({cartItems.length}){" "}
                        <ArrowRight size={16} aria-hidden="true" />
                    </>
                )}
            </button>
            <p className={styles.summaryNote}>
                Shipping is based on your destination. Review your delivery
                details at checkout.
            </p>
        </section>
    );
};

export default CartSummary;
