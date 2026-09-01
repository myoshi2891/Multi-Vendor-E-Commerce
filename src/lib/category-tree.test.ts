import { subtreeOf } from "./category-tree";

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
