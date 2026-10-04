import OrderInfoCard from "@/components/store/cards/order/info";
import OrderTotalDetailsCard from "@/components/store/cards/order/total";
import OrderUserDetailsCard from "@/components/store/cards/order/user";
import StoreHeader from "@/components/store/layout/header/header";
import OrderGroupsContainer from "@/components/store/order-page/groups-container";
import OrderHeader from "@/components/store/order-page/header";
import OrderPayment from "@/components/store/order-page/payment";
import styles from "@/components/store/shared/commerce.module.css";
import { serializeOrderInvoice } from "@/lib/order-invoice";
import {
    createStripePaymentIntent,
    createStripePayment,
} from "@/queries/stripe";
import { createPayPalPayment, capturePayPalPayment } from "@/queries/paypal";
import { getOrder } from "@/queries/order";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Render the order details page for a given route parameter.
 *
 * Fetches the order by `orderId`, redirects to "/" if not found, computes aggregate item counts from the order's groups, and renders the order header, user and order details, groups list, and a conditional payment column when the order requires payment or has failed.
 *
 * @param params - A promise that resolves to the route parameters
 * @param params.orderId - The identifier of the order to display
 * @returns The rendered order details page as a JSX element
 */
export default async function OrderPage({
    params,
}: {
    params: Promise<{ orderId: string }>;
}) {
    const { orderId } = await params;
    const order = await getOrder(orderId);
    if (!order) return redirect("/");

    // Get the total count of items across all groups
    const totalItemsCount = order?.groups.reduce(
        (total, group) => total + group._count.items,
        0
    );

    // Calculate the total number of delivered items
    const deliveredItemsCount = order?.groups.reduce((total, group) => {
        if (group.status === "Delivered") {
            return total + group.items.length;
        }
        return total;
    }, 0);
    const needsPayment =
        order.paymentStatus === "Pending" || order.orderStatus === "Failed";
    return (
        <>
            <StoreHeader />
            <main className={styles.page} data-order-detail>
                <OrderHeader order={serializeOrderInvoice(order)} />
                <div className={styles.layout}>
                    <div className={styles.column}>
                        <OrderGroupsContainer groups={order.groups} />
                    </div>
                    <aside
                        className={styles.aside}
                        aria-label="Order details and payment"
                    >
                        <OrderUserDetailsCard details={order.shippingAddress} />
                        <OrderInfoCard
                            totalItemsCount={totalItemsCount}
                            deliveredItemsCount={deliveredItemsCount}
                            paymentDetails={order.paymentDetails}
                        />
                        <OrderTotalDetailsCard
                            details={{
                                subTotal: order.subTotal.toNumber(),
                                shippingFees: order.shippingFees.toNumber(),
                                total: order.total.toNumber(),
                            }}
                        />
                        {needsPayment && (
                            <OrderPayment
                                orderId={order.id}
                                amount={order.total.toNumber()}
                                actions={{
                                    createIntentAction:
                                        createStripePaymentIntent,
                                    recordStripeAction: createStripePayment,
                                    createPaypalAction: createPayPalPayment,
                                    capturePaypalAction: capturePayPalPayment,
                                }}
                            />
                        )}
                    </aside>
                </div>
            </main>
        </>
    );
}
