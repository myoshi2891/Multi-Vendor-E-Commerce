import SellerOrders from "@/components/dashboard/seller/seller-orders";
import { LookupFailure } from "@/components/dashboard/design/seller-error";
import { serializeSellerOrders } from "@/lib/seller-orders";
import { getStoreOrders } from "@/queries/store";
import { updateOrderGroupStatus, updateOrderItemStatus } from "@/queries/order";
export const dynamic = "force-dynamic";
export default async function SellerOrdersPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    const orders = await getStoreOrders(storeUrl).catch(() => null);
    if (!orders) return <LookupFailure />;
    return (
        <SellerOrders
            orders={serializeSellerOrders(orders)}
            actions={{
                updateGroupAction: updateOrderGroupStatus,
                updateItemAction: updateOrderItemStatus,
            }}
        />
    );
}
