"use client";
import { createStripePayment, createStripePaymentIntent } from "@/queries/stripe";
import {
    useStripe,
    useElements,
    PaymentElement,
} from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function StripePayment({ orderId }: { orderId: string }) {
    const router = useRouter();
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string>();
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        getClientSecret();
    }, [orderId]);

    const getClientSecret = async () => {
        try {
            const res = await createStripePaymentIntent(orderId);
            if (res.clientSecret) setClientSecret(res.clientSecret);
        } catch (error: any) {
            setErrorMessage(error.message);
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setLoading(true);

        if (!stripe || !elements) {
            return
        }

        const { error: submitError } = await elements.submit()
        if (submitError) {
            setErrorMessage(submitError.message);
            setLoading(false);
            return
        }

        if (clientSecret) {
            const {error, paymentIntent } = await stripe.confirmPayment({
                elements,
                clientSecret,
                confirmParams: {
                    return_url: window.location.origin || "http://localhost:3000",
                },
                redirect: "if_required"
            })

            if (!error && paymentIntent) { 
                try { 
                    const res = await createStripePayment(orderId, paymentIntent)
                    if (!res.paymentDetails?.paymentIntentId) throw new Error('Payment details not found');
                    router.refresh()
                } catch (error: any) { 
                    console.error('Error confirming payment:', error);
                    setErrorMessage("Payment failed");
                    return
                }
            }
        }
        setLoading(false);
    };

    if (!clientSecret || !stripe || !elements) {
        return (
            <div className="flex items-center justify-center">
                <div className="inline-block size-8 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125rem] text-slate-800 motion-reduce:animate-[spin_1.5s_linear_infinite] dark:text-white">
                    <span className="!absolute !-m-px !h-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                        Loading...
                    </span>
                </div>
            </div>
        );
    }
    return (
        <form onSubmit={handleSubmit} className="rounded-md bg-white p-2">
            {clientSecret && <PaymentElement />}
            {errorMessage && (
                <div className="text-sm text-red-500">{errorMessage}</div>
            )}
            <button
                disabled={!stripe || loading}
                className="mt-2 w-full rounded-md bg-black p-5 font-bold text-white disabled:animate-pulse disabled:opacity-50"
            >
                {loading ? "Processing..." : "Pay Now"}
            </button>
        </form>
    );
}
