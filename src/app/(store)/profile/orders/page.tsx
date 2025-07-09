import OrdersTable from "@/components/store/profile/orders/orders-table";
import { getUserOrders } from "@/queries/profile";

export default async function ProfileOrdersPage() {
    const orders_data = await getUserOrders();
    const { orders, totalPages } = orders_data;

    return (
        <div>
            <OrdersTable orders={orders} totalPages={totalPages} />
        </div>
    );
}
