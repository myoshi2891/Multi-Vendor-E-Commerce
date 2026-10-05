import { Prisma } from "@prisma/client";
import { serializeSellerOrders } from "@/lib/seller-orders";
import type { StoreOrderType } from "@/lib/types";
it("projects Decimal prices without rescaling or exposing internal relations", () => {
    const group = {
        id: "g",
        storeId: "s",
        status: "Pending",
        total: new Prisma.Decimal("19.9"),
        createdAt: new Date("2026-10-05T00:00:00Z"),
        shippingDeliveryMin: 3,
        shippingDeliveryMax: 5,
        shippingService: "Standard",
        coupon: { internal: "excluded" },
        order: {
            paymentStatus: "Paid",
            paymentDetails: null,
            shippingAddress: {
                address1: "Street",
                address2: null,
                city: "Tokyo",
                state: "Tokyo",
                zip_code: "123",
                country: { name: "Japan" },
                firstName: "A",
                lastName: "Buyer",
                phone: "123",
                user: { email: "buyer@example.test" },
            },
        },
        items: [
            {
                id: "i",
                name: "Item",
                image: "",
                sku: "sku",
                size: "M",
                quantity: 1,
                status: "Pending",
                price: new Prisma.Decimal("12.5"),
                shippingFee: new Prisma.Decimal("7.4"),
                totalPrice: new Prisma.Decimal("19.9"),
            },
        ],
    } as unknown as StoreOrderType;
    const [row] = serializeSellerOrders([group]);
    expect(row.total).toBe(19.9);
    expect(row.items[0]).toMatchObject({
        price: 12.5,
        shippingFee: 7.4,
        totalPrice: 19.9,
    });
    expect(row).not.toHaveProperty("coupon");
    expect(row).not.toHaveProperty("order");
    expect(() => JSON.stringify(row)).not.toThrow();
    expect(row.deliveryRange).toContain("Oct");
});
