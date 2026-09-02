import {
    buildCategoryTree,
    flattenCategoryTree,
    resolveCategoryNode,
    subtreeOf,
} from "./category-tree";

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

    it("DB 障害は null に畳まず再送出する（未解決 slug と区別するため）", async () => {
        // Arrange —— null を返すと呼び出し側が「該当なし = 0 件」に変換してしまい、
        // 障害が「商品が無い」として静かに表示される。
        const failure = new Error("connection terminated");
        mockDb.category.findUnique.mockRejectedValue(failure);
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // Act / Assert
        await expect(resolveCategoryNode("camera", "CATEGORY")).rejects.toThrow(
            failure
        );
        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
    });
});

describe("buildCategoryTree", () => {
    /** テスト用の最小ノード（buildCategoryTree が読むのは id / parentId / path のみ） */
    const node = (id: string, parentId: string | null, path: string) =>
        ({ id, parentId, path, name: id, url: id }) as const;

    it("parentId をたどって親子を復元する", () => {
        // Arrange —— depth 昇順のフラット配列（クエリの orderBy と同じ順）
        const flat = [
            node("electronics", null, "electronics"),
            node("camera", "electronics", "electronics/camera"),
            node("lens", "camera", "electronics/camera/lens"),
        ];

        // Act
        const tree = buildCategoryTree(flat);

        // Assert
        expect(tree).toHaveLength(1);
        expect(tree[0].id).toBe("electronics");
        expect(tree[0].children[0].id).toBe("camera");
        expect(tree[0].children[0].children[0].id).toBe("lens");
    });

    it("入力の並び順を各階層で保つ", () => {
        // Arrange
        const flat = [
            node("a", null, "a"),
            node("b", null, "b"),
            node("a2", "a", "a/a2"),
            node("a1", "a", "a/a1"),
        ];

        // Act
        const tree = buildCategoryTree(flat);

        // Assert —— 並び替えはクエリの orderBy が担当。ここでは順序を触らない
        expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
        expect(tree[0].children.map((n) => n.id)).toEqual(["a2", "a1"]);
    });

    it("親が集合に無いノードを黙って捨てずルートとして残す", () => {
        // Arrange —— 祖先の取りこぼしは枝の消失として現れる。捨てると
        // 「店舗メニューが空」で気づくしかないので、見えるところへ出す。
        const flat = [node("orphan", "missing-parent", "missing-parent/orphan")];

        // Act
        const tree = buildCategoryTree(flat);

        // Assert
        expect(tree.map((n) => n.id)).toEqual(["orphan"]);
    });

    it("空配列には空配列を返す", () => {
        expect(buildCategoryTree([])).toEqual([]);
    });
});

describe("flattenCategoryTree", () => {
    /** テスト用の最小ノード（flatten が読むのは children のみ） */
    interface TestNode {
        id: string;
        parentId: string | null;
        children: TestNode[];
    }
    const node = (
        id: string,
        parentId: string | null,
        children: TestNode[] = []
    ): TestNode => ({ id, parentId, children });

    it("親 → 子孫の深さ優先順（pre-order）で平坦化する", () => {
        // Arrange
        const tree = [
            node("electronics", null, [
                node("camera", "electronics", [node("lens", "camera")]),
                node("audio", "electronics"),
            ]),
            node("fashion", null),
        ];

        // Act
        const flat = flattenCategoryTree(tree);

        // Assert —— 並び替えはしない（順序はクエリの orderBy が決める）
        expect(flat.map((n) => n.id)).toEqual([
            "electronics",
            "camera",
            "lens",
            "audio",
            "fashion",
        ]);
    });

    it("空配列には空配列を返す", () => {
        expect(flattenCategoryTree([])).toEqual([]);
    });
});
