import { getAttributeCategoryOptions } from "@/app/dashboard/admin/attributes/category-options";
import { getAllCategories } from "@/queries/category";
import { createMockCategory } from "@/config/test-fixtures";

jest.mock("@/queries/category", () => ({ getAllCategories: jest.fn() }));

const mockGetAllCategories = getAllCategories as jest.MockedFunction<
    typeof getAllCategories
>;

describe("getAttributeCategoryOptions", () => {
    it("正常系: ツリーを pre-order に平坦化し、選択肢に必要な列だけを返す", async () => {
        // Arrange —— 属性はどの深さにも定義できるため、子孫も選択肢に並ぶ
        const child = {
            ...createMockCategory({
                id: "cat-shoes",
                name: "Shoes",
                parentId: "cat-fashion",
                path: "fashion/shoes",
                depth: 1,
            }),
            children: [],
        };
        const root = {
            ...createMockCategory({
                id: "cat-fashion",
                name: "Fashion",
                path: "fashion",
                depth: 0,
                childCount: 1,
            }),
            children: [child],
        };
        mockGetAllCategories.mockResolvedValue([root] as never);

        // Act
        const options = await getAttributeCategoryOptions();

        // Assert
        expect(options).toEqual([
            { id: "cat-fashion", name: "Fashion", path: "fashion", depth: 0 },
            {
                id: "cat-shoes",
                name: "Shoes",
                path: "fashion/shoes",
                depth: 1,
            },
        ]);
    });

    it("異常系: カテゴリ取得の失敗は握らずに伝播する", async () => {
        // Arrange
        mockGetAllCategories.mockRejectedValue(
            new Error("Failed to fetch categories.")
        );

        // Act & Assert
        await expect(getAttributeCategoryOptions()).rejects.toThrow(
            "Failed to fetch categories."
        );
    });
});
