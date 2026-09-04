/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Footer from "@/components/store/layout/footer/footer";
import { getAllCategories } from "@/queries/category";

/**
 * store footer（`src/components/store/layout/footer/footer.tsx`）の
 * カテゴリリンク選抜ロジック。
 *
 * カテゴリツリー Phase B（plan 067）で、リンク元が旧 `SubCategory` テーブルから
 * `Category` ツリーへ移った。**子ノード優先・無ければルートで埋める**という
 * フォールバックは seed 直後（1 階層しか無い環境）でリンク欄を空にしないための
 * 分岐であり、退行しても「footer が寂しい」形でしか表面化しない。ここで固定する。
 *
 * Server Component なので `await Footer()` の戻り値を render する。
 */

jest.mock("@/queries/category", () => ({
    getAllCategories: jest.fn(),
}));

// `social-logos`（Contact が使う SNS アイコン）は自前の React コピーを同梱しており、
// React 19 の renderer に食わせると "A React Element from an older version of React"
// で落ちる。footer の検証対象はカテゴリ選抜なので、アイコンは素の span に差し替える。
jest.mock("social-logos", () => ({
    __esModule: true,
    default: ({ icon }: { icon: string }) => <span data-social-logo={icon} />,
}));

const mockGetAllCategories = getAllCategories as jest.MockedFunction<
    typeof getAllCategories
>;

/** ツリーノードの最小スタブ（Footer は id / name / url / depth / children しか読まない）。 */
type TreeNodeStub = {
    id: string;
    name: string;
    url: string;
    depth: number;
    children: TreeNodeStub[];
};

const node = (
    id: string,
    depth: number,
    children: TreeNodeStub[] = []
): TreeNodeStub => ({ id, name: id, url: id, depth, children });

const resolveTree = (roots: TreeNodeStub[]) => {
    mockGetAllCategories.mockResolvedValue(
        roots as unknown as Awaited<ReturnType<typeof getAllCategories>>
    );
};

/** "Find it Fast" 見出しを持つカテゴリ欄のリンク名を取り出す。 */
const categoryLinkNames = (): string[] => {
    const column = screen
        .getByRole("heading", { name: "Find it Fast" })
        .closest("div")!;
    return within(column)
        .queryAllByRole("link")
        .map((anchor) => anchor.textContent ?? "");
};

describe("Footer — カテゴリリンクの選抜", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("正常系: 子ノード（旧サブカテゴリ相当）だけを並べ、ルートは除外する", async () => {
        // Arrange —— electronics > camera / phone の 2 階層
        resolveTree([
            node("electronics", 0, [node("camera", 1), node("phone", 1)]),
        ]);

        // Act
        render(await Footer());

        // Assert —— depth > 0 のノードだけが残る
        expect(categoryLinkNames()).toEqual(["camera", "phone"]);
    });

    it("エッジケース: 1 階層しか無ければルートで埋める（リンク欄を空にしない）", async () => {
        // Arrange —— seed 直後を想定した depth 0 のみのツリー
        resolveTree([node("electronics", 0), node("fashion", 0)]);

        // Act
        render(await Footer());

        // Assert
        expect(categoryLinkNames()).toEqual(["electronics", "fashion"]);
    });

    it("境界値: 子ノードが 8 件あっても先頭 7 件で打ち切る", async () => {
        // Arrange
        const children = Array.from({ length: 8 }, (_, index) =>
            node(`child-${index}`, 1)
        );
        resolveTree([node("electronics", 0, children)]);

        // Act
        render(await Footer());

        // Assert —— 上限 7 件。8 件目は落ちる
        expect(categoryLinkNames()).toHaveLength(7);
        expect(categoryLinkNames()).not.toContain("child-7");
    });

    it("異常系: カテゴリ取得が失敗しても throw せず、リンク欄だけ空で描画する", async () => {
        // Arrange —— footer は全ストアページ共通レイアウトなので、
        // DB 障害でページ全体を落とさないことが要件
        mockGetAllCategories.mockRejectedValue(new Error("DB is down"));
        const errorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        // Act
        render(await Footer());

        // Assert —— 描画は継続し、失敗は握り潰さずログに残る
        expect(screen.getByTestId("store-footer")).toBeInTheDocument();
        expect(categoryLinkNames()).toEqual([]);
        expect(errorSpy).toHaveBeenCalledWith(
            "[Footer:getAllCategories] Failed to load categories",
            expect.objectContaining({ error: "DB is down" })
        );

        errorSpy.mockRestore();
    });

    it("エッジケース: カテゴリが 0 件でも footer 自体は描画される", async () => {
        // Arrange
        resolveTree([]);

        // Act
        render(await Footer());

        // Assert
        expect(screen.getByTestId("store-footer")).toBeInTheDocument();
        expect(categoryLinkNames()).toEqual([]);
    });
});
