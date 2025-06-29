import { createPayPalPayment } from "@/queries/paypal";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { useRef } from "react";

export default function PaypalPayment({ orderId }: { orderId: string }) {

    // - Step 1 -----> create order ------> paymentId
    // - Step 2 -----> capture payment (paymentId)
    // - Step 3 -----> update order status and payment details
    const paymentIdRef = useRef("")
    const createOrder = async (data: any, actions: any) => { 
        const response = await createPayPalPayment(orderId)
        paymentIdRef.current = response.id

        return response.id
    }
    return (
        <div>
            <PayPalButtons createOrder={createOrder} onApprove={} onError={} />
        </div>
    );
}
