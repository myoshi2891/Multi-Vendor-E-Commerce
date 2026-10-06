import { serializeAdminStores } from "./admin-stores";
import type { AdminStoreType } from "./types";

const base = {
    id: "store-1",
    name: "Store",
    description: "desc",
    url: "store",
    logo: "logo.png",
    cover: "cover.png",
    status: "ACTIVE",
    featured: false,
    email: "s@example.com",
    phone: "000",
    defaultShippingService: "Express",
    defaultShippingFeePerItem: 1.5,
    defaultShippingFeeForAdditionalItem: 0.5,
    defaultShippingFeePerKg: 2,
    defaultShippingFeeFixed: 3,
    defaultDeliveryTimeMin: 2,
    defaultDeliveryTimeMax: 5,
    returnPolicy: "30 days",
} as unknown as AdminStoreType;

describe("serializeAdminStores", () => {
    it("配送設定を表示用文字列に整形する", () => {
        // Arrange / Act
        const [row] = serializeAdminStores([base]);
        // Assert
        expect(row.shipping).toEqual([
            ["Shipping service", "Express"],
            ["Shipping fee per item", "$1.50"],
            ["Shipping fee for additional item", "$0.50"],
            ["Shipping fee per kg", "$2.00"],
            ["Shipping fee fixed", "$3.00"],
            ["Delivery minimum", "2 days"],
            ["Delivery maximum", "5 days"],
            ["Return policy", "30 days"],
        ]);
    });

    it("配送サービス・返品ポリシー未設定は '-' にフォールバックする", () => {
        const store = {
            ...base,
            defaultShippingService: "",
            returnPolicy: "",
        } as unknown as AdminStoreType;
        const [row] = serializeAdminStores([store]);
        expect(row.shipping[0]).toEqual(["Shipping service", "-"]);
        expect(row.shipping[7]).toEqual(["Return policy", "-"]);
    });
});
