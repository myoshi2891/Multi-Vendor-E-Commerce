import { resolveCategoryNode, subtreeOf } from "./category-tree";

jest.mock("@/lib/db", () => ({
    db: {
        category: { findUnique: jest.fn() },
        categorySlugAlias: { findUnique: jest.fn() },
    },
}));

import { db } from "@/lib/db";

const mockDb = db as unknown as {
    category: { findUnique: jest.Mock };
    categorySlugAlias: { findUnique: jest.Mock };
};

describe("subtreeOf", () => {
    it("完全一致と子孫の 2 条件を OR で返す", () => {
        // Arrange
        const path = "electronics/camera";

        // Act
        const where = subtreeOf(path);

        // Assert
        expect(where).toEqual({
            OR: [{ path: "electronics/camera" }, { path: { startsWith: "electronics/camera/" } }],
        });
    });

    it("兄弟 prefix を子孫として拾わない（境界文字 / を必ず伴う）", () => {
        // Arrange —— 素の startsWith(p) だと electronics/camera-accessories が
        // electronics/camera のサブツリーに化ける。067 V-1 の回帰ガード。
        const [, descendants] = subtreeOf("electronics/camera").OR;

        // Act
        const prefix = descendants.path.startsWith;

        // Assert
        expect("electronics/camera-accessories".startsWith(prefix)).toBe(false);
        expect("electronics/camera/lens".startsWith(prefix)).toBe(true);
    });

    it("ルートノードでも自分自身を含む", () => {
        // Arrange / Act
        const where = subtreeOf("electronics");

        // Assert
        expect(where.OR[0]).toEqual({ path: "electronics" });
        expect(where.OR[1].path.startsWith).toBe("electronics/");
    });
});

describe("resolveCategoryNode", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDb.category.findUnique.mockResolvedValue(null);
        mockDb.categorySlugAlias.findUnique.mockResolvedValue(null);
    });

    // design.md §2-Q3 の解決順序をそのまま固定する。
    // CATEGORY は正準 slug が生きているので url 完全一致が先、
    // SUB_CATEGORY はリネームされている可能性があるので別名が先。
    it("CATEGORY は url 完全一致を先に引く", async () => {
        // Arrange
        mockDb.category.findUnique.mockResolvedValue({
            id: "cat-1",
            path: "electronics",
        });

        // Act
        const node = await resolveCategoryNode("electronics", "CATEGORY");

        // Assert
        expect(node).toEqual({ id: "cat-1", path: "electronics" });
        expect(mockDb.category.findUnique).toHaveBeenCalledWith({
            where: { url: "electronics" },
            select: { id: true, path: true, url: true },
        });
        expect(mockDb.categorySlugAlias.findUnique).not.toHaveBeenCalled();
    });

    it("CATEGORY は url が外れたら別名表へ落ちる", async () => {
        // Arrange
        mockDb.categorySlugAlias.findUnique.mockResolvedValue({
            category: { id: "cat-9", path: "electronics/camera", url: "electronics-camera" },
        });

        // Act
        const node = await resolveCategoryNode("camera", "CATEGORY");

        // Assert
        expect(node).toEqual({
            id: "cat-9",
            path: "electronics/camera",
            url: "electronics-camera",
        });
        expect(mockDb.categorySlugAlias.findUnique).toHaveBeenCalledWith({
            where: { entityType_oldSlug: { entityType: "CATEGORY", oldSlug: "camera" } },
            select: { category: { select: { id: true, path: true, url: true } } },
        });
    });

    it("SUB_CATEGORY は別名表を先に引く（リネーム後の旧 slug を他ノードに奪われ得るため）", async () => {
        // Arrange —— 旧 slug "camera" が別のノードの正準 slug になっている状況
        mockDb.category.findUnique.mockResolvedValue({
            id: "other-node",
            path: "toys/camera",
            url: "camera",
        });
        mockDb.categorySlugAlias.findUnique.mockResolvedValue({
            category: { id: "cat-9", path: "electronics/camera", url: "electronics-camera" },
        });

        // Act
        const node = await resolveCategoryNode("camera", "SUB_CATEGORY");

        // Assert —— 別名の指す元のノードが勝つ
        expect(node?.id).toBe("cat-9");
    });

    it("SUB_CATEGORY は別名が無ければ url 完全一致へ落ちる", async () => {
        // Arrange
        mockDb.category.findUnique.mockResolvedValue({
            id: "cat-2",
            path: "lux-women/lux-women-dresses",
            url: "lux-women-dresses",
        });

        // Act
        const node = await resolveCategoryNode("lux-women-dresses", "SUB_CATEGORY");

        // Assert
        expect(node?.id).toBe("cat-2");
    });

    it("どちらでも解決できなければ null を返す（fail-closed の材料）", async () => {
        // Arrange / Act
        const node = await resolveCategoryNode("missing", "CATEGORY");

        // Assert
        expect(node).toBeNull();
    });
});
