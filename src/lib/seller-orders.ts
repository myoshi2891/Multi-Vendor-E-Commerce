import type { StoreOrderType } from "@/lib/types";
import type {
    updateOrderGroupStatus,
    updateOrderItemStatus,
} from "@/queries/order";
import { getShippingDatesRange, toNumberSafe } from "@/lib/utils";
export type SellerOrderActions = {
    updateGroupAction: typeof updateOrderGroupStatus;
    updateItemAction: typeof updateOrderItemStatus;
};
export function serializeSellerOrders(orders: StoreOrderType[]) {
    return orders.map((group) => {
        const address = group.order.shippingAddress;
        const dates = getShippingDatesRange(
            group.shippingDeliveryMin,
            group.shippingDeliveryMax,
            group.createdAt
        );
        return {
            id: group.id,
            storeId: group.storeId,
            status: group.status,
            total: toNumberSafe(group.total),
            shippingService: group.shippingService,
            deliveryRange: `${dates.minDate} - ${dates.maxDate}`,
            paymentStatus: group.order.paymentStatus,
            paymentMethod: group.order.paymentDetails?.paymentMethod ?? "-",
            paymentReference:
                group.order.paymentDetails?.paymentIntentId ?? "-",
            address: [
                address.address1,
                address.address2,
                address.city,
                address.state,
                address.zip_code,
                address.country.name,
            ]
                .filter(Boolean)
                .join(", "),
            customer: [
                `${address.firstName} ${address.lastName}`,
                address.phone,
                address.user.email,
            ].join(", "),
            items: group.items.map((item) => ({
                id: item.id,
                name: item.name,
                image: item.image,
                sku: item.sku,
                size: item.size,
                quantity: item.quantity,
                status: item.status,
                price: toNumberSafe(item.price),
                shippingFee: toNumberSafe(item.shippingFee),
                totalPrice: toNumberSafe(item.totalPrice),
            })),
        };
    });
}
export type SellerOrderRow = ReturnType<typeof serializeSellerOrders>[number];
