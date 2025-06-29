import { FC } from "react";
import PaypalWrapper from "../cards/payment/paypal/paypal-wrapper";
import StripeWrapper from "../cards/payment/stripe/stripe-wrapper";

interface Props {
    orderId: string;
    amount: number;
}

const OrderPayment: FC<Props> = ({ orderId, amount }) => {
    return <div className="flex h-full flex-col space-y-5">
        {/* Paypal */}
        <PaypalWrapper>
            <div></div>
        </PaypalWrapper>
        {/* Stripe */}
        <StripeWrapper amount={amount}>
            <div></div>
        </StripeWrapper>
    </div>;
};

export default OrderPayment;
