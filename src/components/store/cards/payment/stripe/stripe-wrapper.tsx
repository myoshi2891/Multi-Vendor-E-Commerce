import { ReactNode } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

if (process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY === undefined) {
    throw new Error("Missing Stripe public key");
}
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);
export default function StripeWrapper({
    children,
    amount,
}: {
    children: ReactNode;
    amount: number;
}) {
    return (
        <Elements
            stripe={stripePromise}
            options={{
                appearance: {
                    theme: "stripe",
                    variables: {
                        colorPrimary: "#75613b",
                        colorBackground: "#f8f6ef",
                        colorText: "#17251d",
                        colorDanger: "#8a3028",
                        borderRadius: "0px",
                        fontFamily: "Arial, sans-serif",
                    },
                },
                mode: "payment",
                amount: Math.round(amount * 100), // Convert to cents
                currency: "usd", // Replace with your desired currency
            }}
        >
            {children}
        </Elements>
    );
}
