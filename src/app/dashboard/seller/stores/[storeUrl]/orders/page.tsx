// Queries
import DataTable from "@/components/ui/data-table";
import { columns } from "./columns";
import { Plus } from "lucide-react";
import { getStoreCoupons } from "@/queries/coupon";
import CouponDetails from "@/components/dashboard/forms/coupon-details";
import { getStoreOrders } from "@/queries/store";

export default async function SellerOrdersPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    // Get all coupons for the store
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
