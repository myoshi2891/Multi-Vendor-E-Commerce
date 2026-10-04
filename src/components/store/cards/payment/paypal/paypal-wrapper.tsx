"use client";
import type { ReactNode } from "react";
import {
    PayPalScriptProvider,
    usePayPalScriptReducer,
    DISPATCH_ACTION,
} from "@paypal/react-paypal-js";
import styles from "../../../shared/commerce.module.css";
function PaypalStatus({ children }: { children: ReactNode }) {
    const [{ isPending, isRejected, options }, dispatch] =
        usePayPalScriptReducer();
    if (isRejected)
        return (
            <div>
                <p role="alert" className={styles.error}>
                    PayPal could not be loaded.
                </p>
                <button
                    className={styles.secondary}
                    onClick={() =>
                        dispatch({
                            type: DISPATCH_ACTION.RESET_OPTIONS,
                            value: options,
                        })
                    }
                >
                    Retry PayPal
                </button>
            </div>
        );
    if (isPending)
        return (
            <p role="status" className={styles.status}>
                Loading PayPal…
            </p>
        );
    return children;
}
export default function PaypalWrapper({ children }: { children: ReactNode }) {
    return (
        <PayPalScriptProvider
            options={{
                clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID as string,
                currency: "USD",
            }}
        >
            <PaypalStatus>{children}</PaypalStatus>
        </PayPalScriptProvider>
    );
}
