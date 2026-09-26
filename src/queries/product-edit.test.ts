/**
 * getProductVariantForEdit（既存バリアントの編集ページのデータ読み込み）のユニットテスト。
 *
 * `@/lib/attribute-repository` はモックせず実装を通し、値行 → フォーム値の変換まで見る。
 */
import { Prisma } from "@prisma/client";
import { currentUser } from "@clerk/nextjs/server";
import { getProductVariantForEdit } from "./product";
import { TEST_CONFIG } from "../config/test-config";
import { createMockStore } from "../config/test-fixtures";

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => {
    const model = (...methods: string[]) =>
        Object.fromEntries(methods.map((method) => [method, jest.fn()]));
    return {
        db: {
            store: model("findUnique"),
            product: model("findUnique"),
            productAttributeValue: model("findMany"),
            variantAttributeValue: model("findMany"),
        },
    };
});

const mockDb = require("@/lib/db").db;

const STORE_URL = "test-store";
const STORE_ID = TEST_CONFIG.DEFAULT_STORE_ID;

const productRow = (overrides: Record<string, unknown> = {}) => ({
    id: "product-1",
    name: "Camera",
    description: "desc",
    brand: "Acme",
    categoryId: "cat-root",
    subCategoryId: "cat-leaf",
    offerTagId: null,
    shippingFeeMethod: "ITEM",
    freeShippingForAllCountries: false,
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-02"),
    specs: [{ id: "s1", name: "Care", value: "Wipe" }],
    questions: [{ id: "q1", question: "Q?", answer: "A" }],
    freeShipping: {
        eligibleCountries: [
            { country: { id: "jp", name: "Japan" } },
            { country: { id: "fr", name: "France" } },
        ],
    },
    variants: [
        {
            id: "variant-1",
            variantName: "Black",
            variantDescription: null,
            variantImage: "https://example.test/v.png",
            sku: "SKU-1",
            weight: 1.5,
            keywords: "camera,black",
            isSale: true,
            saleEndDate: "2026-12-31T00:00:00.000Z",
            images: [{ id: "i1", url: "https://example.test/1.png" }],
            colors: [{ id: "c1", name: "Black" }],
            sizes: [
                {
                    id: "z1",
                    size: "M",
                    quantity: 3,
                    price: new Prisma.Decimal("199.99"),
                    discount: 10,
                },
            ],
            specs: [{ id: "vs1", name: "Lens", value: "35mm" }],
        },
    ],
    ...overrides,
});

const asOwner = () => {
    (currentUser as jest.Mock).mockResolvedValue({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role: "SELLER" },
    });
    mockDb.store.findUnique.mockResolvedValue(
        createMockStore({ id: STORE_ID, url: STORE_URL })
    );
};

beforeEach(() => {
    jest.clearAllMocks();
    mockDb.productAttributeValue.findMany.mockResolvedValue([]);
    mockDb.variantAttributeValue.findMany.mockResolvedValue([]);
});

describe("getProductVariantForEdit", () => {
    describe("認可（IDOR 3 階層）", () => {
        it("(a) 店舗の所有者でなければ Forbidden をスローする", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(null);

            // Act & Assert
            await expect(
                getProductVariantForEdit(STORE_URL, "product-1", "variant-1")
            ).rejects.toThrow("Forbidden: store not owned by current user.");
        });

        it("(b) 商品は店舗 id で絞り、バリアントは variantId で絞って引く", async () => {
            asOwner();
            mockDb.product.findUnique.mockResolvedValue(productRow());

            await getProductVariantForEdit(STORE_URL, "product-1", "variant-1");

            expect(mockDb.product.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "product-1", storeId: STORE_ID },
                    include: expect.objectContaining({
                        variants: expect.objectContaining({
                            where: { id: "variant-1" },
                        }),
                    }),
                })
            );
        });

        it("(c) 認可に落ちたら商品も属性値も読まない", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                getProductVariantForEdit(STORE_URL, "product-1", "variant-1")
            ).rejects.toThrow();
            expect(mockDb.product.findUnique).not.toHaveBeenCalled();
            expect(
                mockDb.productAttributeValue.findMany
            ).not.toHaveBeenCalled();
        });
    });

    it("商品が無い（他店舗の商品を含む）なら null", async () => {
        asOwner();
        mockDb.product.findUnique.mockResolvedValue(null);

        await expect(
            getProductVariantForEdit(STORE_URL, "product-1", "variant-1")
        ).resolves.toBeNull();
    });

    it("バリアントがその商品に無ければ null（属性値は読まない）", async () => {
        asOwner();
        mockDb.product.findUnique.mockResolvedValue(
            productRow({ variants: [] })
        );

        await expect(
            getProductVariantForEdit(STORE_URL, "product-1", "other-variant")
        ).resolves.toBeNull();
        expect(mockDb.productAttributeValue.findMany).not.toHaveBeenCalled();
    });

    it("保存時の形式から編集フォームの形へ戻す", async () => {
        // Arrange
        asOwner();
        mockDb.product.findUnique.mockResolvedValue(productRow());

        // Act
        const result = await getProductVariantForEdit(
            STORE_URL,
            "product-1",
            "variant-1"
        );

        // Assert
        expect(result).toEqual(
            expect.objectContaining({
                productId: "product-1",
                variantId: "variant-1",
                name: "Camera",
                variantDescription: "",
                categoryId: "cat-root",
                subCategoryId: "cat-leaf",
                offerTagId: undefined,
                isSale: true,
                saleEndDate: "2026-12-31T00:00:00.000Z",
                keywords: ["camera", "black"],
                images: [{ id: "i1", url: "https://example.test/1.png" }],
                colors: [{ id: "c1", color: "Black" }],
                sizes: [
                    {
                        id: "z1",
                        size: "M",
                        quantity: 3,
                        price: 199.99,
                        discount: 10,
                    },
                ],
                product_specs: [{ id: "s1", name: "Care", value: "Wipe" }],
                variant_specs: [{ id: "vs1", name: "Lens", value: "35mm" }],
                questions: [{ id: "q1", question: "Q?", answer: "A" }],
                freeShippingCountriesIds: [
                    { label: "Japan", value: "jp" },
                    { label: "France", value: "fr" },
                ],
            })
        );
    });

    it("キーワード未設定は空配列", async () => {
        asOwner();
        const row = productRow();
        row.variants[0].keywords = "";
        mockDb.product.findUnique.mockResolvedValue(row);

        const result = await getProductVariantForEdit(
            STORE_URL,
            "product-1",
            "variant-1"
        );

        expect(result?.keywords).toEqual([]);
    });

    it("属性値をフォーム初期値と archivedCurrent に載せる", async () => {
        // Arrange
        asOwner();
        mockDb.product.findUnique.mockResolvedValue(productRow());
        mockDb.productAttributeValue.findMany.mockResolvedValue([
            {
                definitionId: "d-color",
                type: "ENUM",
                multiValued: false,
                valueText: null,
                valueNumber: null,
                valueBool: null,
                optionId: "o-old",
                option: {
                    id: "o-old",
                    value: "old",
                    label: "Old",
                    archivedAt: new Date(),
                },
            },
        ]);
        mockDb.variantAttributeValue.findMany.mockResolvedValue([
            {
                definitionId: "d-storage",
                type: "NUMBER",
                multiValued: false,
                valueText: null,
                valueNumber: new Prisma.Decimal("128"),
                valueBool: null,
                optionId: null,
                option: null,
            },
        ]);

        // Act
        const result = await getProductVariantForEdit(
            STORE_URL,
            "product-1",
            "variant-1"
        );

        // Assert
        expect(result?.productAttributes).toEqual({ "d-color": "o-old" });
        expect(result?.variantAttributes).toEqual({ "d-storage": "128" });
        expect(result?.archivedCurrent).toEqual({
            "d-color": [{ id: "o-old", value: "old", label: "Old" }],
        });
        expect(mockDb.variantAttributeValue.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { variantId: "variant-1" } })
        );
    });

    it("DB エラーは汎用メッセージへ畳む", async () => {
        asOwner();
        mockDb.product.findUnique.mockRejectedValue(new Error("db down"));
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});

        await expect(
            getProductVariantForEdit(STORE_URL, "product-1", "variant-1")
        ).rejects.toThrow("Failed to load the product for editing.");
        expect(spy).toHaveBeenCalledWith(
            "[product:getProductVariantForEdit] Failed to load product",
            expect.objectContaining({ error: "db down" })
        );
        spy.mockRestore();
    });
});
