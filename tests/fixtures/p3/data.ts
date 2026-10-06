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
export const stores = [
    {
        id: "store-1",
        name: "Example store",
        description: "Existing description ".repeat(15),
        url: "example",
        logo: "",
        cover: "",
        status: "PENDING",
        featured: true,
        email: "seller@example.test",
        phone: "1234567890",
        defaultShippingService: "Standard",
        defaultShippingFeePerItem: amount(12.5),
        defaultShippingFeeForAdditionalItem: amount(2),
        defaultShippingFeePerKg: amount(3),
        defaultShippingFeeFixed: amount(4),
        defaultDeliveryTimeMin: 2,
        defaultDeliveryTimeMax: 5,
        returnPolicy: "Existing return policy",
    },
];
export const coupons = [
    {
        id: "coupon-1",
        code: "WELCOME",
        discount: 10,
        startDate: "2026-10-01T12:30:00",
        endDate: "2026-12-01T12:30:00",
        isActive: true,
        scope: "STORE",
        storeId: "store-1",
        createdAt: new Date("2026-10-01"),
        updatedAt: new Date("2026-10-01"),
    },
];
let loads = 0;
export async function loadCoupon() {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (location.search.includes("loadfailure") && loads++ === 0)
        throw Error("fixture");
    return location.search.includes("missingcoupon") ? null : coupons[0];
}

export const categories = [
    {
        id: "cat-1",
        name: "Shoes",
        url: "shoes",
        path: "shoes",
        depth: 0,
        parentId: null,
        sortOrder: 0,
        featured: true,
        image: "https://example.test/shoes.png",
        createdAt: new Date("2026-10-01"),
        updatedAt: new Date("2026-10-01"),
        children: [
            {
                id: "cat-2",
                name: "A long category name for responsive layout",
                url: "boots",
                path: "shoes/boots",
                depth: 1,
                parentId: "cat-1",
                sortOrder: 1,
                featured: false,
                image: "https://example.test/boots.png",
                createdAt: new Date("2026-10-01"),
                updatedAt: new Date("2026-10-01"),
                children: [],
            },
        ],
    },
];
let categoryLoads = 0;
export async function loadCategory(id: string) {
    await new Promise((r) => setTimeout(r, 200));
    if (location.search.includes("loadfailure") && categoryLoads++ === 0)
        throw Error("fixture");
    return location.search.includes("missing")
        ? null
        : id === "cat-1"
          ? categories[0]
          : categories[0].children[0];
}

export const offerTags = [
    {
        id: "tag-1",
        name: "Summer offers with a long seasonal title",
        url: "summer-offers",
        createdAt: new Date("2026-10-01"),
        updatedAt: new Date("2026-10-01"),
    },
];
let offerLoads = 0;
export async function loadOffer() {
    await new Promise((r) => setTimeout(r, 200));
    if (location.search.includes("loadfailure") && offerLoads++ === 0)
        throw Error("fixture");
    return location.search.includes("missing") ? null : offerTags[0];
}
