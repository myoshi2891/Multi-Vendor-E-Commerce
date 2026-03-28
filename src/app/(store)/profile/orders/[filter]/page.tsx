import OrdersTable from "@/components/store/profile/orders/orders-table";
import { OrderTableFilter } from "@/lib/types";
import { getUserOrders } from "@/queries/profile";

/**
 * Render the profile orders page filtered by the route's `filter` parameter.
 *
 * @param params - A promise that resolves to an object containing the route `filter` string.
 * @returns A React element that displays the user's orders table filtered according to the provided route filter.
 */
export default async function ProfileFilteredOrderPage({
    params,
}: {
    params: Promise<{ filter: string }>;
    }) {
    const { filter: rawFilter } = await params;
    const validFilterMap: Record<string, OrderTableFilter> = {
        "": "",
        unpaid: "unpaid",
        toShip: "toShip",
        shipped: "shipped",
        delivered: "delivered",
    };
    const filter: OrderTableFilter = Object.hasOwn(validFilterMap, rawFilter)
        ? validFilterMap[rawFilter]
        : "";
    const orders_data = await getUserOrders(filter);
    const { orders, totalPages } = orders_data;

    return (
        <div>
            <OrdersTable orders={orders} totalPages={totalPages} prev_filter={filter} />
        </div>
    );
}
