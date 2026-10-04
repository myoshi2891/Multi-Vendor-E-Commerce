import type { OrderFullType } from "./types";

/** Only the fields needed by the existing PDF/header cross the client boundary. */
export function serializeOrderInvoice(order: NonNullable<OrderFullType>) {
    const { id, createdAt, orderStatus, paymentStatus, shippingAddress } =
        order;
    return {
        id,
        createdAt: createdAt.toISOString(),
        orderStatus,
        paymentStatus,
        subTotal: order.subTotal.toNumber(),
        shippingFees: order.shippingFees.toNumber(),
        total: order.total.toNumber(),
        shippingAddress: {
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
            phone: shippingAddress.phone,
            address1: shippingAddress.address1,
            address2: shippingAddress.address2,
            city: shippingAddress.city,
            state: shippingAddress.state,
            zip_code: shippingAddress.zip_code,
            country: { name: shippingAddress.country.name },
        },
        groups: order.groups.map((group) => ({
            id: group.id,
            store: { name: group.store.name },
            coupon: group.coupon ? { code: group.coupon.code } : null,
            shippingFees: group.shippingFees.toNumber(),
            subTotal: group.subTotal.toNumber(),
            total: group.total.toNumber(),
            _count: group._count,
            items: group.items.map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price.toNumber(),
                totalPrice: item.totalPrice.toNumber(),
            })),
        })),
    };
}
export type OrderInvoice = ReturnType<typeof serializeOrderInvoice>;
