import { getAllCategories } from "@/queries/category";
import { getBrandCategories } from "./data";

/**
 * ラグジュアリーホームのカテゴリ導線（`data.ts`）。
 *
 * jewelry → watches → bags を優先し、残りは元の並びのまま最大 3 件へ詰める。
 * slug は DB の実値（url）をそのまま使うため、表示名と slug が異なっても導線が壊れない。
 * 取得失敗時はホーム全体を落とさず空配列へ畳む。
 */

jest.mock("@/queries/category", () => ({ getAllCategories: jest.fn() }));
const categories = jest.mocked(getAllCategories);
type CategoryTree = Awaited<ReturnType<typeof getAllCategories>>;

const category = (id: string, name: string, url = name.toLowerCase()) =>
    ({
        id,
        name,
        url,
        image: "",
        subCategories: [],
    }) as unknown as CategoryTree[number];

describe("getBrandCategories", () => {
    afterEach(() => jest.restoreAllMocks());

    it("優先カテゴリ (大文字小文字を無視) を先頭に並べ、最大 3 件に絞る", async () => {
        // Arrange
        categories.mockResolvedValue([
            category("c1", "Shoes"),
            category("c2", "Bags"),
            category("c3", "Hats"),
            category("c4", "WATCHES", "fine-watches"),
            category("c5", "Jewelry"),
        ]);

        // Act
        const result = await getBrandCategories();

        // Assert
        expect(result).toEqual([
            { id: "c5", name: "Jewelry", url: "jewelry" },
            { id: "c4", name: "WATCHES", url: "fine-watches" },
            { id: "c2", name: "Bags", url: "bags" },
        ]);
    });

    it("優先カテゴリが無ければ元の並びを保ち、id / name / url だけを返す", async () => {
        // Arrange
        const tree = [category("c1", "Shoes"), category("c2", "Hats")];
        categories.mockResolvedValue(tree);

        // Act
        const result = await getBrandCategories();

        // Assert
        expect(result).toEqual([
            { id: "c1", name: "Shoes", url: "shoes" },
            { id: "c2", name: "Hats", url: "hats" },
        ]);
        expect(tree.map(({ id }) => id)).toEqual(["c1", "c2"]); // 入力配列を破壊しない
    });

    it("取得に失敗したら構造化ログを残して空配列を返す", async () => {
        // Arrange
        const consoleError = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        categories.mockRejectedValue(new Error("DB down"));

        // Act
        const result = await getBrandCategories();

        // Assert
        expect(result).toEqual([]);
        expect(consoleError).toHaveBeenCalledWith(
            "[Home] Categories unavailable",
            {
                error: "DB down",
            }
        );
    });

    it("Error 以外の reject でも空配列を返し、メッセージは Unknown error にする", async () => {
        // Arrange
        const consoleError = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        categories.mockRejectedValue("timeout");

        // Act
        const result = await getBrandCategories();

        // Assert
        expect(result).toEqual([]);
        expect(consoleError).toHaveBeenCalledWith(
            "[Home] Categories unavailable",
            {
                error: "Unknown error",
            }
        );
    });
});
