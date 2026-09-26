import {
    ancestorPathsOf,
    resolveEffectiveDefinitions,
} from "./attribute-definitions";

describe("ancestorPathsOf", () => {
    it("ルートは自分だけを返す", () => {
        expect(ancestorPathsOf("electronics")).toEqual(["electronics"]);
    });

    it("浅い順に自ノードまでの祖先パスを返す", () => {
        expect(ancestorPathsOf("electronics/camera/lens")).toEqual([
            "electronics",
            "electronics/camera",
            "electronics/camera/lens",
        ]);
    });
});

describe("resolveEffectiveDefinitions（A-10: 同一 key は最深ノードが勝つ）", () => {
    const def = (id: string, key: string, path: string) => ({
        id,
        key,
        category: { path },
    });

    it("祖先と子孫が同じ key を持つと子孫の定義だけが残る", () => {
        // Arrange
        const ancestor = def("a", "color", "fashion");
        const descendant = def("d", "color", "fashion/shoes");

        // Act
        const result = resolveEffectiveDefinitions([ancestor, descendant]);

        // Assert
        expect(result).toEqual([descendant]);
    });

    it("入力順が深い→浅いでも最深が勝つ", () => {
        const descendant = def("d", "color", "fashion/shoes");
        const ancestor = def("a", "color", "fashion");

        expect(resolveEffectiveDefinitions([descendant, ancestor])).toEqual([
            descendant,
        ]);
    });

    it("key が異なる定義はすべて残り、入力順を保つ", () => {
        const defs = [
            def("1", "material", "fashion"),
            def("2", "color", "fashion"),
            def("3", "heel_height", "fashion/shoes"),
        ];

        expect(resolveEffectiveDefinitions(defs)).toEqual(defs);
    });

    it("空入力は空配列", () => {
        expect(resolveEffectiveDefinitions([])).toEqual([]);
    });
});
