import type { AdminOrderType } from "@/lib/types";
import { serializeSellerOrders } from "./seller-orders";
import { toNumberSafe } from "./utils";
export function serializeAdminOrders(orders: AdminOrderType[]) {
    return orders.map((order) => ({
        id: order.id,
        paymentStatus: order.paymentStatus,
        total: toNumberSafe(order.total),
        groups: order.groups.map((group) => ({
            ...serializeSellerOrders([
                {
                    ...group,
                    order: {
                        paymentStatus: order.paymentStatus,
                        shippingAddress: order.shippingAddress,
                        paymentDetails: order.paymentDetails,
                    },
                },
            ])[0],
            storeName: group.store.name,
        })),
    }));
}
export type AdminOrderRow = ReturnType<typeof serializeAdminOrders>[number];
