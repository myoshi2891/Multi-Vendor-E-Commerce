import DataTable from "@/components/ui/data-table";
import { columns } from "./columns";
import { getStoreOrders } from "@/queries/store";

export default async function SellerOrdersPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    // Get all orders for the store
    const orders = await getStoreOrders(storeUrl);

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
