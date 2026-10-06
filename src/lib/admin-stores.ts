import type { AdminStoreType } from "@/lib/types";
import { toNumberSafe } from "./utils";
export function serializeAdminStores(stores: AdminStoreType[]) {
    return stores.map((store) => ({
        id: store.id,
        name: store.name,
        description: store.description,
        url: store.url,
        logo: store.logo,
        cover: store.cover,
        status: store.status,
        featured: store.featured,
        email: store.email,
        phone: store.phone,
        shipping: [
            ["Shipping service", store.defaultShippingService || "-"],
            [
                "Shipping fee per item",
                `$${toNumberSafe(store.defaultShippingFeePerItem).toFixed(2)}`,
            ],
            [
                "Shipping fee for additional item",
                `$${toNumberSafe(store.defaultShippingFeeForAdditionalItem).toFixed(2)}`,
            ],
            [
                "Shipping fee per kg",
                `$${toNumberSafe(store.defaultShippingFeePerKg).toFixed(2)}`,
            ],
            [
                "Shipping fee fixed",
                `$${toNumberSafe(store.defaultShippingFeeFixed).toFixed(2)}`,
            ],
            ["Delivery minimum", `${store.defaultDeliveryTimeMin} days`],
            ["Delivery maximum", `${store.defaultDeliveryTimeMax} days`],
            ["Return policy", store.returnPolicy || "-"],
        ],
    }));
}
export type AdminStoreRow = ReturnType<typeof serializeAdminStores>[number];
