/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Links, {
    FooterCategoryLink,
} from "@/components/store/layout/footer/links";

/**
 * footer のカテゴリリンク（`src/components/store/layout/footer/links.tsx`）。
 *
 * カテゴリツリー Phase B（plan 067）で **href の形が `?subCategory=` から
 * `?category=` へ変わった**箇所であり、ここが退行すると /browse 側の 308 正準化を
 * 毎回 1 ホップ踏む旧挙動へ黙って戻る（見た目は同じままなので目視では気づけない）。
 * href の形とパラメータ名を特性化して固定する。
 */

const link = (
    overrides: Partial<FooterCategoryLink> = {}
): FooterCategoryLink => ({
    id: "c1",
    name: "Electronics",
    url: "electronics",
    ...overrides,
});

/** "Find it Fast" 見出しを持つカテゴリ欄だけを切り出す。 */
const categoryColumn = () =>
    screen.getByRole("heading", { name: "Find it Fast" }).closest("div")!;

describe("Links（footer カテゴリリンク）", () => {
    it("正常系: カテゴリを ?category=<正準slug> のリンクとして描画する", () => {
        // Arrange
        const categories = [
            link({ id: "c1", name: "Electronics", url: "electronics" }),
            link({ id: "c2", name: "Camera", url: "electronics-camera" }),
        ];

        // Act
        render(<Links categories={categories} />);

        // Assert —— パラメータ名は category（旧 subCategory ではない）
        expect(
            screen.getByRole("link", { name: "Electronics" })
        ).toHaveAttribute("href", "/browse?category=electronics");
        expect(screen.getByRole("link", { name: "Camera" })).toHaveAttribute(
            "href",
            "/browse?category=electronics-camera"
        );
    });

    it("エッジケース: カテゴリが空でも見出しだけ描き、リンクは 1 件も出さない", () => {
        // Arrange / Act
        render(<Links categories={[]} />);

        // Assert
        expect(
            screen.getByRole("heading", { name: "Find it Fast" })
        ).toBeInTheDocument();
        expect(within(categoryColumn()).queryAllByRole("link")).toHaveLength(0);
    });

    it("正常系: 固定リンクを 6 件目で分割し Customer care 欄へ送る", () => {
        // Arrange / Act
        render(<Links categories={[link()]} />);

        // Assert —— 前半 6 件はプロフィール欄、7 件目以降が Customer care 欄
        expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
            "href",
            "/about"
        );
        expect(
            screen.getByRole("link", { name: "Store Directory" })
        ).toHaveAttribute("href", "/profile");

        const customerCare = screen
            .getByRole("heading", { name: "Customer care" })
            .closest("div")!;
        expect(
            within(customerCare).getByRole("link", { name: "My Account" })
        ).toBeInTheDocument();
        expect(
            within(customerCare).queryByRole("link", { name: "About" })
        ).not.toBeInTheDocument();
    });
});
