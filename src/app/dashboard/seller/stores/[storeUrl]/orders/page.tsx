import DataTable from "@/components/ui/data-table";
import { columns } from "./columns";
import { getStoreOrders } from "@/queries/store";

/**
 * Render the seller orders page for a specific store.
 *
 * Fetches orders for the store identified by `storeUrl` and renders a DataTable listing those orders.
 * If fetching fails, logs the error and renders the table with no orders.
 *
 * @param params - A promise that resolves to an object with `storeUrl`, the store identifier used to load orders.
 * @returns The page JSX containing a DataTable of the store's orders.
 */
export default async function SellerOrdersPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;

    let orders: Awaited<ReturnType<typeof getStoreOrders>> = [];
    try {
        orders = await getStoreOrders(storeUrl);
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[SellerOrders] Failed to fetch orders:", error.message, error.stack);
        } else {
            console.error("[SellerOrders] Failed to fetch orders:", error);
        }
    }

    return (
        <div>
            <DataTable
                filterValue="id"
                data={orders}
                columns={columns}
                searchPlaceholder="Search order by id ..."
            />
        </div>
    );
}
