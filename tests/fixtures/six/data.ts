// Isolated design data: no DB writes or SDK requests.
export const rootId = "11111111-1111-4111-8111-111111111111";
export const leafId = "22222222-2222-4222-8222-222222222222";
export const categories = [
    {
        id: rootId,
        name: "Accessories",
        url: "accessories",
        path: "accessories",
        depth: 0,
        childCount: 1,
        parentId: null,
        children: [
            {
                id: leafId,
                name: "Watches",
                url: "watches",
                path: "accessories/watches",
                depth: 1,
                childCount: 0,
                parentId: rootId,
                children: [],
            },
        ],
    },
];
export const countries = [
    { id: "33333333-3333-4333-8333-333333333333", name: "Japan", code: "JP" },
];
export const product = {
    productId: "product-1",
    variantId: "variant-1",
    name: "An example watch with a long descriptive product name",
    description:
        "An example product description for the isolated design fixture. ".repeat(
            5
        ),
    variantName: "Gold",
    variantDescription: "",
    images: [1, 2, 3].map(() => ({
        url: "http://127.0.0.1:3123/assets/images/default-user.jpg",
    })),
    variantImage: "http://127.0.0.1:3123/assets/images/default-user.jpg",
    categoryId: rootId,
    subCategoryId: leafId,
    brand: "Example",
    sku: "WATCH-001",
    weight: 1.5,
    colors: [{ color: "#d4ba83" }],
    sizes: [{ size: "M", quantity: 3, price: 12.5, discount: 0 }],
    keywords: ["watch", "gold", "classic", "time", "accessory"],
    product_specs: [{ name: "Material", value: "Gold" }],
    variant_specs: [{ name: "Finish", value: "Polished" }],
    questions: [],
    isSale: false,
    shippingFeeMethod: "ITEM",
    freeShippingForAllCountries: false,
    freeShippingCountriesIds: [],
};
export const store = {
    id: "store-1",
    userId: "seller-1",
    name: "Example store",
    description:
        "An example store description for responsive design verification.",
    email: "seller@example.test",
    phone: "1234567890",
    url: "example",
    logo: "http://127.0.0.1:3123/assets/images/default-user.jpg",
    cover: "http://127.0.0.1:3123/assets/images/default-user.jpg",
    featured: false,
    status: "ACTIVE",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
};
const decimal = (value: number) => ({ toNumber: () => value });
export const shipping = {
    defaultShippingService: "Standard delivery",
    defaultShippingFeePerItem: decimal(12.5),
    defaultShippingFeeForAdditionalItem: decimal(2.5),
    defaultShippingFeePerKg: decimal(1),
    defaultShippingFeeFixed: decimal(0),
    defaultDeliveryTimeMin: 1,
    defaultDeliveryTimeMax: 5,
    returnPolicy: "Return eligible items within the existing return policy.",
};
export const rates = [
    {
        countryId: countries[0].id,
        countryName: "Japan",
        countryCode: "JP",
        shippingRate: {
            id: "rate-1",
            shippingService: "Standard delivery",
            shippingFeePerItem: decimal(12.5),
            shippingFeeForAdditionalItem: decimal(2.5),
            shippingFeePerKg: decimal(1),
            shippingFeeFixed: decimal(0),
            deliveryTimeMin: 1,
            deliveryTimeMax: 5,
            returnPolicy:
                "Return eligible items within the existing return policy.",
        },
    },
    {
        countryId: "other-country",
        countryName: "An example country with a long name",
        countryCode: "XX",
        shippingRate: null,
    },
];
let attempts = 0;
export async function save(...args: unknown[]) {
    (window as unknown as { saved: unknown[] }).saved = args;
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (location.search.includes("failure") && attempts++ === 0)
        throw new Error("Private fixture failure");
    return { ...store, ...shipping, id: "saved-1" };
}
