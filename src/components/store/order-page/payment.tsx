"use client";
import type { PaymentActions } from "@/lib/commerce-actions";
import { useState } from "react";
import PaypalWrapper from "../cards/payment/paypal/paypal-wrapper";
import StripeWrapper from "../cards/payment/stripe/stripe-wrapper";
import PaypalPayment from "../cards/payment/paypal/paypal-payment";
import StripePayment from "../cards/payment/stripe/stripe-payment";
import styles from "../shared/commerce.module.css";
export default function OrderPayment({
    orderId,
    amount,
    actions,
}: {
    orderId: string;
    amount: number;
    actions: PaymentActions;
}) {
    const [busy, setBusy] = useState<"paypal" | "stripe" | null>(null);
    return (
        <section
            className={styles.panel}
            data-testid="order-payment"
            aria-labelledby="order-payment-title"
        >
            <h2 id="order-payment-title">Payment</h2>
            <h3>PayPal</h3>
            <PaypalWrapper>
                <PaypalPayment
                    orderId={orderId}
                    actions={actions}
                    disabled={busy === "stripe"}
                    onBusyChange={(pending) =>
                        setBusy((current) =>
                            pending
                                ? "paypal"
                                : current === "paypal"
                                  ? null
                                  : current
                        )
                    }
                />
            </PaypalWrapper>
            <h3 style={{ marginTop: 24 }}>Card payment</h3>
            <StripeWrapper amount={amount}>
                <StripePayment
                    orderId={orderId}
                    actions={actions}
                    disabled={busy === "paypal"}
                    onBusyChange={(pending) =>
                        setBusy((current) =>
                            pending
                                ? "stripe"
                                : current === "stripe"
                                  ? null
                                  : current
                        )
                    }
                />
            </StripeWrapper>
        </section>
    );
}
