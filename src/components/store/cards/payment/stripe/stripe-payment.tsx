"use client";
import type { PaymentActions } from "@/lib/commerce-actions";
import {
    useStripe,
    useElements,
    PaymentElement,
} from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "../../../shared/commerce.module.css";

type Props = {
    orderId: string;
    actions: Pick<PaymentActions, "createIntentAction" | "recordStripeAction">;
    disabled?: boolean;
    onBusyChange?: (busy: boolean) => void;
};
export default function StripePayment({
    orderId,
    actions,
    disabled = false,
    onBusyChange,
}: Props) {
    const router = useRouter(),
        stripe = useStripe(),
        elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string>();
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [retry, setRetry] = useState(0);
    const locked = useRef(false);
    useEffect(() => {
        let cancelled = false;
        setClientSecret(null);
        setErrorMessage(undefined);
        void actions
            .createIntentAction(orderId)
            .then((res) => {
                if (!res.clientSecret)
                    throw new Error("Payment could not be initialized.");
                if (!cancelled) setClientSecret(res.clientSecret);
            })
            .catch((error) => {
                if (!cancelled)
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : "Payment could not be initialized."
                    );
            });
        return () => {
            cancelled = true;
        };
        // Only order changes or explicit retry should initialize the payment.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, retry]);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (locked.current || disabled || !stripe || !elements || !clientSecret)
            return;
        locked.current = true;
        setLoading(true);
        onBusyChange?.(true);
        setErrorMessage(undefined);
        let paid = false;
        try {
            const { error: submitError } = await elements.submit();
            if (submitError) {
                setErrorMessage(
                    submitError.message ?? "Please check your payment details."
                );
                return;
            }
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                clientSecret,
                confirmParams: { return_url: window.location.origin },
                redirect: "if_required",
            });
            if (error) {
                setErrorMessage(error.message ?? "Payment failed");
                return;
            }
            if (paymentIntent) {
                const res = await actions.recordStripeAction(
                    orderId,
                    paymentIntent.id
                );
                if (!res.paymentDetails?.paymentIntentId)
                    throw new Error("Payment failed");
                paid = true;
                router.refresh();
            } else {
                setErrorMessage("Payment failed");
            }
        } catch {
            setErrorMessage("Payment failed");
        } finally {
            if (!paid) {
                locked.current = false;
                setLoading(false);
                onBusyChange?.(false);
            }
        }
    }
    if (errorMessage && !clientSecret)
        return (
            <div>
                <p className={styles.error} role="alert">
                    {errorMessage}
                </p>
                <button
                    className={styles.secondary}
                    disabled={disabled}
                    onClick={() => setRetry((value) => value + 1)}
                >
                    Retry card payment
                </button>
            </div>
        );
    if (!clientSecret || !stripe || !elements)
        return (
            <p role="status" className={styles.status}>
                Loading card payment…
            </p>
        );
    return (
        <form onSubmit={handleSubmit} aria-label="Card payment">
            <fieldset disabled={disabled || loading} style={{ minWidth: 0 }}>
                <legend className="sr-only">Card details</legend>
                <PaymentElement options={{ readOnly: disabled || loading }} />
                <button
                    disabled={disabled || loading}
                    className={styles.primary}
                    style={{ width: "100%", marginTop: 18 }}
                >
                    {loading ? "Processing..." : "Pay Now"}
                </button>
            </fieldset>
            {loading && (
                <p role="status" className={styles.status}>
                    Processing card payment…
                </p>
            )}
            {errorMessage && (
                <p role="alert" className={styles.error}>
                    {errorMessage}
                </p>
            )}
        </form>
    );
}
