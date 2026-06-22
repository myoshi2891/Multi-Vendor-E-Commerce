/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { getAllOfferTags } from "@/queries/offer-tag";
import OffersPage from "./page";

// オファー取得クエリをモック（Prisma 到達不要）。各テストで戻り値を上書きする。
jest.mock("@/queries/offer-tag", () => ({
    getAllOfferTags: jest.fn(),
}));
// next/link を素の <a> に差し替え（jsdom で href 検証を可能にする）
jest.mock("next/link", () => ({
    __esModule: true,
    default: ({
        children,
        href,
    }: React.PropsWithChildren<{ href: string }>) => (
        <a href={href}>{children}</a>
    ),
}));

const mockGetAllOfferTags = getAllOfferTags as jest.Mock;

describe("OffersPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("オファータグ一覧と /browse?offer=<url> リンクを描画する（AC-OF1）", async () => {
        // Arrange — getAllOfferTags がタグ2件を返す
        mockGetAllOfferTags.mockResolvedValueOnce([
            {
                id: "tag-1",
                name: "Summer Sale",
                url: "summer-sale",
                products: [{ id: "p1" }, { id: "p2" }],
            },
            {
                id: "tag-2",
                name: "Clearance",
                url: "clearance",
                products: [{ id: "p3" }],
            },
        ]);

        // Act — async Server Component は await して描画する
        render(await OffersPage());

        // Assert — タグ名がリンクとして描画され、href が /browse?offer=<url>
        const summerLink = screen.getByRole("link", { name: /Summer Sale/ });
        expect(summerLink).toHaveAttribute("href", "/browse?offer=summer-sale");

        const clearanceLink = screen.getByRole("link", { name: /Clearance/ });
        expect(clearanceLink).toHaveAttribute("href", "/browse?offer=clearance");
    });

    it("タグが空のとき空状態メッセージを描画する（AC-OF2）", async () => {
        // Arrange
        mockGetAllOfferTags.mockResolvedValueOnce([]);

        // Act
        render(await OffersPage());

        // Assert
        expect(
            screen.getByText("現在ご紹介できるオファーはありません。")
        ).toBeInTheDocument();
        // 空状態ではオファーリンクは描画されない
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
});
