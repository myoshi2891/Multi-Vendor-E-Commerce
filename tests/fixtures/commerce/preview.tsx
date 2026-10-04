/* Browser-only fixtures: no query module, Clerk, database or payment provider is invoked. */
import React from "react";
import Link from "next/link";
import { createRoot } from "react-dom/client";
import Checkout from "@/components/store/checkout-page/container";
import OrderHeader from "@/components/store/order-page/header";
import OrderGroups from "@/components/store/order-page/groups-container";
import OrderTotal from "@/components/store/cards/order/total";
import OrderUser from "@/components/store/cards/order/user";
import OrderInfo from "@/components/store/cards/order/info";
import OrderPayment from "@/components/store/order-page/payment";
import styles from "@/components/store/shared/commerce.module.css";
import { serializeOrderInvoice } from "@/lib/order-invoice";
import { serializeCart } from "@/lib/serialize-cart";
import type { CheckoutActions, PaymentActions } from "@/lib/commerce-actions";
import type { OrderFullType } from "@/lib/types";
import {
    createMockCart,
    createMockCartItem,
    createMockCountry,
    createMockShippingAddress,
    createMockUser,
    createMockStore,
    createMockOrder,
    createMockOrderGroup,
    createMockOrderItem,
    createMockCoupon,
    createMockPaymentDetails,
} from "@/config/test-fixtures";

const scenario =
    new URLSearchParams(location.search).get("scenario") ?? "checkout";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const country = createMockCountry({
    id: "8fa7d3a0-e04f-4eec-ab77-afc9c08b475e",
});
const address = {
    ...createMockShippingAddress({
        id: "49494d77-09b8-4db2-80eb-1277c7a33d1e",
        countryId: country.id,
        default: true,
        address1: "A very long delivery address ".repeat(6),
    }),
    country,
    user: createMockUser({ picture: "/assets/images/default-user.jpg" }),
};
let addresses = [
    address,
    {
        ...address,
        id: "9e7d8bbd-9de9-496f-bd71-a5bfc973a172",
        default: false,
        firstName: "Second",
    },
];
const store = createMockStore({
    name: "A long store name ".repeat(6),
    logo: "/assets/images/no_image.png",
});
const items = [
    createMockCartItem({
        id: "item-1",
        price: 10,
        totalPrice: 25,
        name: "A considered piece with a very long name ".repeat(7),
        image: "/assets/images/no_image.png",
    }),
];
let cart = serializeCart({
    ...createMockCart({
        id: "cart-fixture",
        subTotal: 20,
        shippingFees: 5,
        total: 25,
    }),
    cartItems: items,
    coupon: null,
});
let refreshCalls = 0;
const actions = {
    refreshCartAction: async () => {
        refreshCalls++;
        if (scenario === "checkout-pending") await delay(2000);
        if (scenario === "checkout-error" && refreshCalls === 1)
            throw new Error("fixture refresh failure");
        return cart;
    },
    placeOrderAction: async () => {
        await delay(800);
        throw new Error("fixture order failure");
    },
    emptyCartAction: async () => true,
    applyCouponAction: async () => {
        await delay(800);
        if (scenario === "coupon-error") throw new Error("Invalid coupon code");
        cart = {
            ...cart,
            coupon: {
                ...createMockCoupon({ code: "SAVE10" }),
                startDate: "2026-01-01",
                endDate: "2027-12-31",
                store: {
                    ...store,
                    defaultShippingFeePerItem: 0,
                    defaultShippingFeeForAdditionalItem: 0,
                    defaultShippingFeePerKg: 0,
                    defaultShippingFeeFixed: 0,
                },
            },
        };
        return { message: "Coupon applied!", cart };
    },
    loadAddressesAction: async () => addresses,
    saveAddressAction: async (input) => {
        await delay(800);
        if (scenario === "address-error")
            throw new Error("fixture address error");
        const saved = {
            ...address,
            ...input,
            id: input.id ?? "b2c408ff-ef69-4c9d-bcbc-1219ac8fe983",
        };
        addresses = [
            ...addresses
                .filter((item) => item.id !== saved.id)
                .map((item) => ({
                    ...item,
                    default: saved.default ? false : item.default,
                })),
            saved,
        ];
        return saved;
    },
    makeDefaultAction: async (id) => {
        await delay(800);
        addresses = addresses.map((item) => ({
            ...item,
            default: item.id === id,
        }));
        return { id };
    },
} satisfies CheckoutActions;
const paymentActions = {
    createIntentAction: async () => {
        await delay(200);
        throw new Error("Payment could not be initialized.");
    },
    recordStripeAction: async () => {
        throw new Error("fixture only");
    },
    createPaypalAction: async () => {
        throw new Error("fixture only");
    },
    capturePaypalAction: async () => {
        throw new Error("fixture only");
    },
} satisfies PaymentActions;
const order = {
    ...createMockOrder({
        id: "order-id-".repeat(15),
        subTotal: 40,
        shippingFees: 10,
        total: 50,
        paymentStatus: scenario === "order-paid" ? "Paid" : "Pending",
    }),
    shippingAddress: address,
    paymentDetails:
        scenario === "order-paid"
            ? createMockPaymentDetails({ status: "Completed" })
            : null,
    groups: [0, 1].map((index) => ({
        ...createMockOrderGroup({
            id: `group-${index}`,
            subTotal: 20,
            shippingFees: 5,
            total: 25,
        }),
        coupon: null,
        store,
        _count: { items: 1 },
        items: [
            createMockOrderItem({
                id: `order-item-${index}`,
                name: items[0].name,
                image: items[0].image,
                price: 10,
                totalPrice: 25,
                quantity: 2,
            }),
        ],
    })),
} as NonNullable<OrderFullType>;
function App() {
    if (scenario.startsWith("order"))
        return (
            <main className={styles.page} data-order-detail>
                <OrderHeader order={serializeOrderInvoice(order)} />
                <div className={styles.layout}>
                    <div className={styles.column}>
                        <OrderGroups groups={order.groups} />
                    </div>
                    <aside
                        className={styles.aside}
                        aria-label="Order details and payment"
                    >
                        <OrderUser details={address} />
                        <OrderInfo
                            totalItemsCount={2}
                            deliveredItemsCount={0}
                            paymentDetails={order.paymentDetails}
                        />
                        <OrderTotal
                            details={{
                                subTotal: 40,
                                shippingFees: 10,
                                total: 50,
                            }}
                        />
                        {scenario !== "order-paid" && (
                            <OrderPayment
                                orderId={order.id}
                                amount={50}
                                actions={paymentActions}
                            />
                        )}
                    </aside>
                </div>
            </main>
        );
    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                    <Link href="/">Home</Link>
                    <Link href="/cart">Your bag</Link>
                    <span aria-current="page">Checkout</span>
                </nav>
                <h1>Checkout</h1>
                <p>Confirm your delivery details and review your order.</p>
            </header>
            <Checkout
                cart={
                    scenario === "checkout-empty"
                        ? { ...cart, cartItems: [] }
                        : cart
                }
                countries={[country]}
                addresses={scenario === "address-empty" ? [] : addresses}
                userCountry={{
                    name: "Japan",
                    code: "JP",
                    city: "",
                    region: "",
                }}
                actions={actions}
            />
        </main>
    );
}
createRoot(document.getElementById("root")!).render(<App />);
