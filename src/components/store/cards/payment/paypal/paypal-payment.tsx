"use client";
import type { PaymentActions } from "@/lib/commerce-actions";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import styles from "../../../shared/commerce.module.css";
export default function PaypalPayment({
    orderId,
    actions,
    disabled = false,
    onBusyChange,
}: {
    orderId: string;
    actions: Pick<PaymentActions, "createPaypalAction" | "capturePaypalAction">;
    disabled?: boolean;
    onBusyChange?: (busy: boolean) => void;
}) {
    const router = useRouter();
    const paymentIdRef = useRef("");
    const locked = useRef(false);
    const capturing = useRef(false);
    const [error, setError] = useState(false),
        [pending, setPending] = useState(false);
    function release() {
        locked.current = false;
        capturing.current = false;
        setPending(false);
        onBusyChange?.(false);
    }
    function fail(err: unknown) {
        console.error("[PaypalPayment] PayPal Button Error:", err);
        setError(true);
        release();
    }
    async function createOrder() {
        if (locked.current || disabled)
            throw new Error("Payment already in progress.");
        locked.current = true;
        setPending(true);
        onBusyChange?.(true);
        setError(false);
        try {
            const response = await actions.createPaypalAction(orderId);
            paymentIdRef.current = response.id;
            return response.id;
        } catch (err) {
            fail(err);
            throw err;
        }
    }
    async function onApprove() {
        if (capturing.current) return;
        capturing.current = true;
        try {
            const response = await actions.capturePaypalAction(
                orderId,
                paymentIdRef.current
            );
            if (response.id) router.refresh();
            else release();
        } catch (err) {
            fail(err);
            throw err;
        }
    }
    return (
        <div>
            <PayPalButtons
                createOrder={createOrder}
                onApprove={onApprove}
                disabled={disabled}
                onCancel={release}
                onError={fail}
                style={{ layout: "vertical", shape: "rect" }}
            />
            {pending && (
                <p role="status" className={styles.status}>
                    Processing PayPal payment…
                </p>
            )}
            {error && (
                <p role="alert" className={styles.error}>
                    PayPal payment failed. Please try again.
                </p>
            )}
        </div>
    );
}
