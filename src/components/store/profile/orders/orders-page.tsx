import type { OrderTableFilter } from "@/lib/types";
import { getUserOrdersForDisplay } from "@/queries/profile";
import OrdersTable from "./orders-table";

export default async function OrdersPage({
    filter = "",
}: {
    filter?: OrderTableFilter;
}) {
    let result: Awaited<ReturnType<typeof getUserOrdersForDisplay>> = {
        orders: [],
        totalPages: 0,
    };
    let initialError = false;
    try {
        result = await getUserOrdersForDisplay(filter);
    } catch {
        initialError = true;
    }
    return (
        <OrdersTable
            key={filter}
            {...result}
            prev_filter={filter}
            initialError={initialError}
            fetchOrdersAction={getUserOrdersForDisplay}
        />
    );
}
