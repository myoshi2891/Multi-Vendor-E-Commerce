import type * as User from "@/queries/user";
import type * as Coupon from "@/queries/coupon";
import type * as Stripe from "@/queries/stripe";
import type * as Paypal from "@/queries/paypal";

export type CheckoutActions = {
    refreshCartAction: typeof User.updateCheckoutProductWithLatest;
    placeOrderAction: typeof User.placeOrder;
    emptyCartAction: typeof User.emptyUserCart;
    applyCouponAction: typeof Coupon.applyCoupon;
    loadAddressesAction: typeof User.getUserShippingAddresses;
    saveAddressAction: typeof User.saveProfileShippingAddress;
    makeDefaultAction: typeof User.makeProfileShippingAddressDefault;
};
export type PaymentActions = {
    createIntentAction: typeof Stripe.createStripePaymentIntent;
    recordStripeAction: typeof Stripe.createStripePayment;
    createPaypalAction: typeof Paypal.createPayPalPayment;
    capturePaypalAction: typeof Paypal.capturePayPalPayment;
};
