import OrdersPage from "@/components/store/profile/orders/orders-page";
import { OrderTableFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    return <OrdersPage filter={filter} />;
}
