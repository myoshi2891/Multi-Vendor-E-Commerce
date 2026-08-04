"use client";
import { FC } from "react";
import PaypalWrapper from "../cards/payment/paypal/paypal-wrapper";
import StripeWrapper from "../cards/payment/stripe/stripe-wrapper";
import PaypalPayment from "../cards/payment/paypal/paypal-payment";
import StripePayment from "../cards/payment/stripe/stripe-payment";

interface Props {
    orderId: string;
    amount: number;
}

const OrderPayment: FC<Props> = ({ orderId, amount }) => {
    // data-testid: E2E から決済プロバイダ非依存に支払い領域を掴むためのアンカー。
    // 個々の SDK 要素（.StripeElement / PayPal iframe）は遅延ロードとプロバイダ構成の
    // 変更に弱いため、両者を収容するコンテナ側で固定する。
    return (
        <div
            className="flex h-full flex-col space-y-5"
            data-testid="order-payment"
        >
            {/* Paypal */}
            <PaypalWrapper>
                <PaypalPayment orderId={orderId} />
            </PaypalWrapper>
            {/* Stripe */}
            <StripeWrapper amount={amount}>
                <StripePayment orderId={orderId} />
            </StripeWrapper>
        </div>
    );
};

export default OrderPayment;
