"use client";
import { capturePayPalPayment, createPayPalPayment } from "@/queries/paypal";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { useRef } from "react";

export default function PaypalPayment({ orderId }: { orderId: string }) {
    // - Step 1 -----> create order ------> paymentId
    // - Step 2 -----> capture payment (paymentId)
    // - Step 3 -----> update order status and payment details
    const router = useRouter();
    const paymentIdRef = useRef("");
    const createOrder = async (data: any, actions: any) => {
        const response = await createPayPalPayment(orderId);
        paymentIdRef.current = response.id;

        return response.id;
    };

    const onApprove = async () => {
        const captureResponse = await capturePayPalPayment(
            orderId,
            paymentIdRef.current
        );
        if (captureResponse.id) router.refresh();
    };
    return (
        <div>
            <PayPalButtons
                createOrder={createOrder}
                onApprove={onApprove}
                onError={(err) => console.log("Paypal Button Error:", err)}
            />
        </div>
    );
}
