const amount = (value: number) => ({ toNumber: () => value });
export const orders = [
    {
        id: "order-1",
        paymentStatus: "Paid",
        total: amount(12.5),
        shippingAddress: {
            address1: "Long address ".repeat(10),
            address2: "",
            city: "Tokyo",
            state: "Tokyo",
            zip_code: "1000001",
            firstName: "Test",
            lastName: "Customer",
            phone: "1234567890",
            country: { name: "Japan" },
            user: { email: "test@example.test" },
        },
        paymentDetails: { paymentMethod: "Stripe", paymentIntentId: "ref-1" },
        groups: [
            {
                id: "group-1",
                storeId: "store-1",
                status: "Pending",
                total: amount(12.5),
                shippingService: "Standard delivery",
                shippingDeliveryMin: 2,
                shippingDeliveryMax: 5,
                createdAt: new Date("2026-10-01"),
                store: { name: "Long store ".repeat(8) },
                items: [
                    {
                        id: "item-1",
                        name: "Long item ".repeat(8),
                        image: "",
                        sku: "SKU-1",
                        size: "M",
                        quantity: 1,
                        status: "Pending",
                        price: amount(12.5),
                        shippingFee: amount(0),
                        totalPrice: amount(12.5),
                    },
                ],
            },
        ],
    },
];
let attempts = 0;
export async function save(...args: unknown[]) {
    const target = window as unknown as { calls: unknown[][] };
    target.calls ??= [];
    target.calls.push(args);
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (location.search.includes("failure") && attempts++ === 0)
        throw Error("fixture failure");
    return args[args.length - 1];
}
