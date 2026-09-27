import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import {
    upsertAttributeDefinition,
    archiveAttributeDefinition,
    restoreAttributeDefinition,
    upsertAttributeOption,
    archiveAttributeOption,
    changeAttributeTypeToNumber,
    getEffectiveAttributeDefinitions,
} from "./attribute";
import { TEST_CONFIG } from "../config/test-config";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => {
    const client = {
        $queryRaw: jest.fn(),
        $transaction: jest.fn(),
        category: { findUnique: jest.fn() },
        attributeDefinition: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            findUniqueOrThrow: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        },
        attributeOption: {
            findFirst: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        },
        productAttributeValue: {
            count: jest.fn(),
            findMany: jest.fn(),
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        variantAttributeValue: {
            count: jest.fn(),
            findMany: jest.fn(),
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
    };
    return { db: client };
});

const mockDb = require("@/lib/db").db;

const asAdmin = () =>
    (currentUser as jest.Mock).mockResolvedValue({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role: "ADMIN" },
    });

const asSeller = () =>
    (currentUser as jest.Mock).mockResolvedValue({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role: "SELLER" },
    });

const validDefinition = (overrides: Record<string, unknown> = {}) => ({
    categoryId: "cat-1",
    key: "screen_size",
    name: "Screen size",
    type: "NUMBER",
    scope: "PRODUCT",
    unit: "inch",
    required: false,
    facetable: true,
    multiValued: false,
    sortOrder: 0,
    ...overrides,
});

const lockedDefinition = (overrides: Record<string, unknown> = {}) => ({
    id: "def-1",
    categoryId: "cat-1",
    key: "screen_size",
    name: "Screen size",
    type: "NUMBER",
    scope: "PRODUCT",
    unit: "inch",
    required: false,
    facetable: true,
    multiValued: false,
    sortOrder: 0,
    archivedAt: null,
    ...overrides,
});

const recordNotFound = () =>
    new Prisma.PrismaClientKnownRequestError("Record to update not found", {
        code: "P2025",
        clientVersion: "test",
    });

const uniqueViolation = () =>
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
    });

beforeEach(() => {
    // clearAllMocks は mockRejectedValue 等の実装を残すため、テスト間で漏れる。
    // 実装ごと初期化してから $transaction の委譲を張り直す。
    jest.resetAllMocks();
    mockDb.$transaction.mockImplementation(
        async (fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)
    );
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ==================================================
// upsertAttributeDefinition
// ==================================================
describe("upsertAttributeDefinition", () => {
    describe("認可", () => {
        it("ADMIN 以外は認可エラーのまま拒否し、DB に触れない", async () => {
            // Arrange
            asSeller();

            // Act & Assert
            await expect(
                upsertAttributeDefinition(validDefinition())
            ).rejects.toThrow("Only admins can perform this action.");
            expect(mockDb.$transaction).not.toHaveBeenCalled();
        });

        it("未認証は Unauthenticated で拒否する", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                upsertAttributeDefinition(validDefinition())
            ).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("入力検証", () => {
        it("ENUM 以外の多値は拒否する（D-7）", async () => {
            asAdmin();

            await expect(
                upsertAttributeDefinition(
                    validDefinition({ multiValued: true, facetable: false })
                )
            ).rejects.toThrow("Only ENUM attributes can be multi-valued.");
            expect(mockDb.$transaction).not.toHaveBeenCalled();
        });

        it("TEXT の facetable は拒否する（ADR-007 Risks）", async () => {
            asAdmin();

            await expect(
                upsertAttributeDefinition(
                    validDefinition({ type: "TEXT", facetable: true })
                )
            ).rejects.toThrow("TEXT attributes cannot be facetable.");
        });

        it("snake_case でない key は拒否する", async () => {
            asAdmin();

            await expect(
                upsertAttributeDefinition(
                    validDefinition({ key: "Screen-Size" })
                )
            ).rejects.toThrow("Key must be lowercase snake_case");
        });
    });

    describe("作成（INSERT ... ON CONFLICT）", () => {
        it("作成した定義を返す", async () => {
            // Arrange
            asAdmin();
            mockDb.$queryRaw.mockResolvedValue([
                {
                    id: "def-1",
                    type: "NUMBER",
                    scope: "PRODUCT",
                    multiValued: false,
                },
            ]);
            const saved = { id: "def-1" };
            mockDb.attributeDefinition.findUniqueOrThrow.mockResolvedValue(
                saved
            );

            // Act
            const result = await upsertAttributeDefinition(validDefinition());

            // Assert
            expect(result).toBe(saved);
            expect(mockDb.$queryRaw).toHaveBeenCalledTimes(1);
            expect(
                mockDb.attributeDefinition.findUniqueOrThrow
            ).toHaveBeenCalledWith({
                where: { id: "def-1" },
            });
        });

        it("同 key のアクティブ定義と形が食い違えば拒否する（tx で巻き戻す）", async () => {
            asAdmin();
            mockDb.$queryRaw.mockResolvedValue([
                {
                    id: "def-1",
                    type: "TEXT",
                    scope: "PRODUCT",
                    multiValued: false,
                },
            ]);

            await expect(
                upsertAttributeDefinition(validDefinition())
            ).rejects.toThrow("different type, scope or multi-valued");
            expect(
                mockDb.attributeDefinition.findUniqueOrThrow
            ).not.toHaveBeenCalled();
        });

        it("未知の DB エラーは構造化ログを残して汎用メッセージに畳む", async () => {
            asAdmin();
            mockDb.$queryRaw.mockRejectedValue(new Error("connection reset"));

            await expect(
                upsertAttributeDefinition(validDefinition())
            ).rejects.toThrow("Error saving attribute.");
            expect(console.error).toHaveBeenCalledWith(
                "[Attribute:upsertAttributeDefinition] Error saving attribute.",
                expect.objectContaining({ error: "connection reset" })
            );
        });
    });

    describe("更新（id 指定）", () => {
        it("key の変更は拒否する（Q7: 不変の機械キー）", async () => {
            asAdmin();
            mockDb.$queryRaw.mockResolvedValue([
                lockedDefinition({ key: "size" }),
            ]);

            await expect(
                upsertAttributeDefinition({ id: "def-1", ...validDefinition() })
            ).rejects.toThrow("Attribute key cannot be changed.");
            expect(mockDb.attributeDefinition.update).not.toHaveBeenCalled();
        });

        it("アーカイブ済み定義の編集は拒否する", async () => {
            asAdmin();
            mockDb.$queryRaw.mockResolvedValue([
                lockedDefinition({ archivedAt: new Date() }),
            ]);

            await expect(
                upsertAttributeDefinition({ id: "def-1", ...validDefinition() })
            ).rejects.toThrow("Restore the attribute before editing it.");
        });

        it("値が存在する間は type を変更できない", async () => {
            asAdmin();
            mockDb.$queryRaw.mockResolvedValue([
                lockedDefinition({ type: "TEXT" }),
            ]);
            mockDb.productAttributeValue.count.mockResolvedValue(1);
            mockDb.variantAttributeValue.count.mockResolvedValue(0);

            await expect(
                upsertAttributeDefinition({ id: "def-1", ...validDefinition() })
            ).rejects.toThrow("cannot be changed while values exist");
            expect(mockDb.attributeDefinition.update).not.toHaveBeenCalled();
        });

        it("値が無ければ type を変更できる", async () => {
            asAdmin();
            mockDb.$queryRaw.mockResolvedValue([
                lockedDefinition({ type: "TEXT" }),
            ]);
            mockDb.productAttributeValue.count.mockResolvedValue(0);
            mockDb.variantAttributeValue.count.mockResolvedValue(0);
            mockDb.attributeDefinition.update.mockResolvedValue({
                id: "def-1",
            });

            await upsertAttributeDefinition({
                id: "def-1",
                ...validDefinition(),
            });

            expect(mockDb.attributeDefinition.update).toHaveBeenCalledWith({
                where: { id: "def-1" },
                data: expect.objectContaining({
                    type: "NUMBER",
                    name: "Screen size",
                }),
            });
        });

        it("カテゴリ移動先で key が衝突したら重複メッセージを返す", async () => {
            asAdmin();
            mockDb.$queryRaw.mockResolvedValue([lockedDefinition()]);
            mockDb.attributeDefinition.update.mockRejectedValue(
                uniqueViolation()
            );

            await expect(
                upsertAttributeDefinition({
                    id: "def-1",
                    ...validDefinition({ categoryId: "cat-2" }),
                })
            ).rejects.toThrow(
                "An active attribute with the same key already exists"
            );
        });
    });
});

// ==================================================
// archive / restore
// ==================================================
describe("archiveAttributeDefinition / restoreAttributeDefinition", () => {
    it("archive は archivedAt を立てる（物理削除しない・D-4）", async () => {
        asAdmin();
        mockDb.attributeDefinition.update.mockResolvedValue({ id: "def-1" });

        await archiveAttributeDefinition("def-1");

        expect(mockDb.attributeDefinition.update).toHaveBeenCalledWith({
            where: { id: "def-1", archivedAt: null },
            data: { archivedAt: expect.any(Date) },
        });
    });

    it("アーカイブ済み（または存在しない）定義の archive は拒否し、archivedAt を上書きしない", async () => {
        // Arrange —— where の archivedAt: null に一致しない行は P2025
        asAdmin();
        mockDb.attributeDefinition.update.mockRejectedValue(recordNotFound());

        // Act & Assert
        await expect(archiveAttributeDefinition("def-1")).rejects.toThrow(
            "Attribute not found or already archived."
        );
    });

    it("restore で同 key のアクティブ定義と衝突したら重複メッセージを返す", async () => {
        asAdmin();
        mockDb.attributeDefinition.update.mockRejectedValue(uniqueViolation());

        await expect(restoreAttributeDefinition("def-1")).rejects.toThrow(
            "An active attribute with the same key already exists"
        );
    });

    it("ADMIN 以外は archive できない", async () => {
        asSeller();

        await expect(archiveAttributeDefinition("def-1")).rejects.toThrow(
            "Only admins can perform this action."
        );
        expect(mockDb.attributeDefinition.update).not.toHaveBeenCalled();
    });
});

describe("archiveAttributeOption", () => {
    it("アクティブな選択肢だけを対象に archivedAt を立てる", async () => {
        asAdmin();
        mockDb.attributeOption.update.mockResolvedValue({ id: "opt-1" });

        await archiveAttributeOption("opt-1");

        expect(mockDb.attributeOption.update).toHaveBeenCalledWith({
            where: { id: "opt-1", archivedAt: null },
            data: { archivedAt: expect.any(Date) },
        });
    });

    it("アーカイブ済み（または存在しない）選択肢の archive は拒否する", async () => {
        asAdmin();
        mockDb.attributeOption.update.mockRejectedValue(recordNotFound());

        await expect(archiveAttributeOption("opt-1")).rejects.toThrow(
            "Option not found or already archived."
        );
    });
});

// ==================================================
// upsertAttributeOption
// ==================================================
describe("upsertAttributeOption", () => {
    const option = { value: "wheat", label: "Wheat", sortOrder: 0 };

    it("ENUM 以外の定義には追加できない", async () => {
        asAdmin();
        mockDb.attributeDefinition.findUnique.mockResolvedValue({
            type: "TEXT",
            archivedAt: null,
        });

        await expect(upsertAttributeOption("def-1", option)).rejects.toThrow(
            "Options can only be added to ENUM attributes."
        );
        expect(mockDb.attributeOption.create).not.toHaveBeenCalled();
    });

    it("ENUM 定義に選択肢を作成する", async () => {
        asAdmin();
        mockDb.attributeDefinition.findUnique.mockResolvedValue({
            type: "ENUM",
            archivedAt: null,
        });
        mockDb.attributeOption.create.mockResolvedValue({ id: "opt-1" });

        await upsertAttributeOption("def-1", option);

        expect(mockDb.attributeOption.create).toHaveBeenCalledWith({
            data: { ...option, definitionId: "def-1" },
        });
    });

    it("value（機械値）の変更は拒否し、label だけを更新できる", async () => {
        asAdmin();
        mockDb.attributeDefinition.findUnique.mockResolvedValue({
            type: "ENUM",
            archivedAt: null,
        });
        mockDb.attributeOption.findFirst.mockResolvedValue({ value: "egg" });

        await expect(
            upsertAttributeOption("def-1", { id: "opt-1", ...option })
        ).rejects.toThrow("Option value cannot be changed.");
        expect(mockDb.attributeOption.update).not.toHaveBeenCalled();
    });

    it("label の改名は update で行う（A-4 の自動追随は FK が担う）", async () => {
        asAdmin();
        mockDb.attributeDefinition.findUnique.mockResolvedValue({
            type: "ENUM",
            archivedAt: null,
        });
        mockDb.attributeOption.findFirst.mockResolvedValue({ value: "wheat" });
        mockDb.attributeOption.update.mockResolvedValue({ id: "opt-1" });

        await upsertAttributeOption("def-1", {
            id: "opt-1",
            ...option,
            label: "Wheat (gluten)",
        });

        expect(mockDb.attributeOption.update).toHaveBeenCalledWith({
            where: { id: "opt-1" },
            data: { label: "Wheat (gluten)", sortOrder: 0 },
        });
    });

    it("同じ value の重複は重複メッセージを返す", async () => {
        asAdmin();
        mockDb.attributeDefinition.findUnique.mockResolvedValue({
            type: "ENUM",
            archivedAt: null,
        });
        mockDb.attributeOption.create.mockRejectedValue(uniqueViolation());

        await expect(upsertAttributeOption("def-1", option)).rejects.toThrow(
            "An option with the same value already exists."
        );
    });
});

// ==================================================
// changeAttributeTypeToNumber（A-7）
// ==================================================
describe("changeAttributeTypeToNumber", () => {
    const textRow = (id: string, productId: string, valueText: string) => ({
        id,
        productId,
        definitionId: "def-1",
        type: "TEXT",
        multiValued: false,
        valueText,
        valueNumber: null,
        valueBool: null,
        optionId: null,
    });

    it("TEXT 以外は変換できない", async () => {
        asAdmin();
        mockDb.$queryRaw.mockResolvedValue([
            lockedDefinition({ type: "NUMBER" }),
        ]);

        await expect(changeAttributeTypeToNumber("def-1")).rejects.toThrow(
            "Only TEXT attributes can be converted to NUMBER."
        );
    });

    it("経路 1: 全行変換可能なら値行を NUMBER で作り直し、定義の type を変える", async () => {
        // Arrange
        asAdmin();
        mockDb.$queryRaw.mockResolvedValue([
            lockedDefinition({ type: "TEXT", facetable: false }),
        ]);
        mockDb.productAttributeValue.findMany.mockResolvedValue([
            textRow("v1", "p1", "55"),
            textRow("v2", "p2", " 32.5 "),
        ]);

        // Act
        const result = await changeAttributeTypeToNumber("def-1");

        // Assert
        expect(result).toEqual({
            route: 1,
            definitionId: "def-1",
            converted: 2,
            unconvertible: 0,
        });
        expect(mockDb.productAttributeValue.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ["v1", "v2"] } },
        });
        expect(mockDb.attributeDefinition.update).toHaveBeenCalledWith({
            where: { id: "def-1" },
            data: { type: "NUMBER" },
        });
        const [{ data }] =
            mockDb.productAttributeValue.createMany.mock.calls[0];
        expect(data).toHaveLength(2);
        expect(data[1]).toMatchObject({
            productId: "p2",
            definitionId: "def-1",
            type: "NUMBER",
            valueText: null,
        });
        expect(data[1].valueNumber.toString()).toBe("32.5");
    });

    it("経路 2: 変換不能な行があれば旧定義を archive し、変換可能な値だけを新定義へ移す", async () => {
        // Arrange
        asAdmin();
        mockDb.$queryRaw.mockResolvedValue([
            lockedDefinition({ type: "TEXT", facetable: false }),
        ]);
        mockDb.productAttributeValue.findMany.mockResolvedValue([
            textRow("v1", "p1", "28"),
            textRow("v2", "p2", "28g (45cm) / 32g (50cm)"),
        ]);
        mockDb.attributeDefinition.create.mockResolvedValue({ id: "def-2" });

        // Act
        const result = await changeAttributeTypeToNumber("def-1");

        // Assert
        expect(result).toEqual({
            route: 2,
            definitionId: "def-2",
            converted: 1,
            unconvertible: 1,
        });
        expect(mockDb.attributeDefinition.update).toHaveBeenCalledWith({
            where: { id: "def-1" },
            data: { archivedAt: expect.any(Date) },
        });
        expect(mockDb.attributeDefinition.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                key: "screen_size",
                type: "NUMBER",
                categoryId: "cat-1",
            }),
        });
        // 変換不能な v2 は旧定義に残す（NULL 化しない）
        expect(mockDb.productAttributeValue.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ["v1"] } },
        });
        const [{ data }] =
            mockDb.productAttributeValue.createMany.mock.calls[0];
        expect(data).toEqual([
            expect.objectContaining({ productId: "p1", definitionId: "def-2" }),
        ]);
    });
});

// ==================================================
// getEffectiveAttributeDefinitions
// ==================================================
describe("getEffectiveAttributeDefinitions", () => {
    it("categoryId が空なら DB に触れず空配列", async () => {
        await expect(getEffectiveAttributeDefinitions("")).resolves.toEqual([]);
        expect(mockDb.category.findUnique).not.toHaveBeenCalled();
    });

    it("カテゴリが存在しなければ空配列", async () => {
        mockDb.category.findUnique.mockResolvedValue(null);

        await expect(
            getEffectiveAttributeDefinitions("missing")
        ).resolves.toEqual([]);
    });

    it("祖先パス集合で引き、同一 key は最深ノードの定義を返す（A-2 / A-10）", async () => {
        // Arrange
        mockDb.category.findUnique.mockResolvedValue({ path: "fashion/shoes" });
        const base = {
            type: "ENUM",
            scope: "PRODUCT",
            unit: null,
            required: false,
            multiValued: false,
            options: [],
        };
        mockDb.attributeDefinition.findMany.mockResolvedValue([
            {
                ...base,
                id: "a",
                key: "color",
                name: "Color",
                category: { path: "fashion" },
            },
            {
                ...base,
                id: "d",
                key: "color",
                name: "Colour",
                category: { path: "fashion/shoes" },
            },
            {
                ...base,
                id: "m",
                key: "material",
                name: "Material",
                category: { path: "fashion" },
            },
        ]);

        // Act
        const result = await getEffectiveAttributeDefinitions("shoes-id");

        // Assert
        expect(mockDb.attributeDefinition.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    category: { path: { in: ["fashion", "fashion/shoes"] } },
                    archivedAt: null,
                },
            })
        );
        expect(result.map((d) => d.id)).toEqual(["d", "m"]);
        expect(result[0]).not.toHaveProperty("category");
    });
});
