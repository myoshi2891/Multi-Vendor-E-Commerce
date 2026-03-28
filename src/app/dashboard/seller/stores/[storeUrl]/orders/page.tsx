import DataTable from "@/components/ui/data-table";
import { columns } from "./columns";
import { getStoreOrders } from "@/queries/store";

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
