import OrdersTable from "@/components/store/profile/orders/orders-table";
import { OrderTableFilter } from "@/lib/types";
import { getUserOrders } from "@/queries/profile";

export default async function ProfileFilteredOrderPage({
    params,
}: {
    params: Promise<{ filter: string }>;
    }) {
    const { filter: rawFilter } = await params;
    const validFilters: OrderTableFilter[] = ["", "unpaid", "toShip", "shipped", "delivered"];
    const filter: OrderTableFilter = validFilters.includes(rawFilter as OrderTableFilter)
        ? (rawFilter as OrderTableFilter)
        : "";
    const orders_data = await getUserOrders(filter);
    const { orders, totalPages } = orders_data;

    return (
        <div>
            <OrdersTable orders={orders} totalPages={totalPages} prev_filter={filter} />
        </div>
    );
}
