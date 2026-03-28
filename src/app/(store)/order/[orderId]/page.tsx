import OrderInfoCard from "@/components/store/cards/order/info";
import OrderTotalDetailsCard from "@/components/store/cards/order/total";
import OrderUserDetailsCard from "@/components/store/cards/order/user";
import StoreHeader from "@/components/store/layout/header/header";
import OrderGroupsContainer from "@/components/store/order-page/groups-container";
import OrderHeader from "@/components/store/order-page/header";
import OrderPayment from "@/components/store/order-page/payment";
import { Separator } from "@/components/ui/separator";
import { getOrder } from "@/queries/order";
import { redirect } from "next/navigation";

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
    return (
        <div>
            <StoreHeader />
            <div className="p-2">
                <OrderHeader order={order} />
                <div
                    className="grid w-full"
                    style={{
                        gridTemplateColumns:
                            order.paymentStatus === "Pending" ||
                            order.orderStatus === "Failed"
                                ? "400px 3fr 1fr"
                                : "1fr 4fr",
                    }}
                >
                    {/* Col 1 -> User, Order details */}
                    <div className="scrollbar flex h-[calc(100vh-137px)] flex-col gap-y-5 overflow-auto">
                        <OrderUserDetailsCard details={order.shippingAddress} />
                        <OrderInfoCard
                            totalItemsCount={totalItemsCount}
                            deliveredItemsCount={deliveredItemsCount}
                            paymentDetails={order.paymentDetails}
                        />
                        {(order.paymentStatus !== "Pending" ||
                            order.orderStatus !== "Failed") && (
                            <OrderTotalDetailsCard
                                details={{
                                    subTotal: order.subTotal.toNumber(),
                                    shippingFees: order.shippingFees.toNumber(),
                                    total: order.total.toNumber(),
                                }}
                            />
                        )}
                    </div>
                    {/* Col 2 -> Order Groups */}
                    <div className="scrollbar h-[calc(100vh-137px)] gap-y-5 overflow-auto">
                        <OrderGroupsContainer groups={order.groups} />
                    </div>
                    {/* Col 3 -> Payment Gateways */}
                    {(order.paymentStatus === "Pending" ||
                        order.orderStatus === "Failed") && (
                        <div className="scrollbar h-[calc(100vh-137px)] gap-y-5 space-y-5 overflow-auto border-l p-4 px-2">
                            <OrderTotalDetailsCard
                                details={{
                                    subTotal: order.subTotal.toNumber(),
                                    shippingFees: order.shippingFees.toNumber(),
                                    total: order.total.toNumber(),
                                }}
                            />
                            <Separator />
                            <OrderPayment
                                orderId={order.id}
                                amount={order.total.toNumber()}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
