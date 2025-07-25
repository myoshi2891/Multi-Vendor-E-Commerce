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
    params: { storeUrl: string };
}) {
    // Get all coupons for the store
    const orders = await getStoreOrders(params.storeUrl);

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
