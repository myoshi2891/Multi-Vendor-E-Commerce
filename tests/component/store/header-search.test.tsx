/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Search from "@/components/store/layout/header/search/search";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// next/navigation は App Router のランタイム依存のため jsdom では動作しない。
jest.mock("next/navigation", () => ({
    usePathname: jest.fn(),
    useRouter: jest.fn(),
    useSearchParams: jest.fn(),
}));

// next/image は jsdom では最適化ローダーが動かないため素の <img> に置き換える。
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} />
    ),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockFetch = jest.fn();

/** サジェスト API の応答（SearchResult 形）を返す fetch モックを仕込む。 */
const respondWith = (body: unknown, ok = true) => {
    mockFetch.mockResolvedValue({
        ok,
        status: ok ? 200 : 500,
        statusText: ok ? "OK" : "Internal Server Error",
        json: async () => body,
    });
};

const renderSearch = () => {
    (useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams("") as unknown as ReturnType<typeof useSearchParams>
    );
    (usePathname as jest.Mock).mockReturnValue("/");
    (useRouter as jest.Mock).mockReturnValue({
        push: mockPush,
        replace: mockReplace,
    });
    return render(<Search />);
};

/** 入力して、非同期の fetch → setState まで流し切る。 */
const typeQuery = async (value: string) => {
    await act(async () => {
        fireEvent.change(screen.getByRole("textbox"), { target: { value } });
    });
};

describe("ヘッダー検索 Search", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = mockFetch as unknown as typeof fetch;
    });

    it("2 文字以上の入力で /api/search-products を q パラメータで呼ぶ", async () => {
        // Arrange
        respondWith([]);
        renderSearch();

        // Act
        await typeQuery("coat");

        // Assert — route は q しか読まない。search= で呼ぶと常に空になる（plan 073）
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][0]).toBe("/api/search-products?q=coat");
    });

    it("2 文字未満では API を呼ばない", async () => {
        // Arrange
        respondWith([]);
        renderSearch();

        // Act
        await typeQuery("c");

        // Assert
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("SearchResult の配列をサジェストとして描画し、クリックで link へ遷移する", async () => {
        // Arrange
        respondWith([
            {
                id: "p1",
                name: "Wool Coat",
                link: "/product/wool-coat/wool-coat-black",
                image: "https://example.test/coat.png",
            },
        ]);
        renderSearch();

        // Act
        await typeQuery("coat");
        fireEvent.click(screen.getByRole("img", { name: "Wool Coat" }));

        // Assert
        expect(mockPush).toHaveBeenCalledWith(
            "/product/wool-coat/wool-coat-black"
        );
    });

    it("正規表現の特殊文字を含む入力でも描画が落ちない", async () => {
        // Arrange — 入力をそのまま new RegExp に渡すと "(" で SyntaxError になる
        respondWith([
            {
                id: "p1",
                name: "Coat (Wool)",
                link: "/product/coat/coat-1",
                image: "https://example.test/coat.png",
            },
        ]);
        renderSearch();

        // Act
        await typeQuery("(w");

        // Assert — 一致部分は強調され、描画は維持される
        expect(
            screen.getByRole("img", { name: "Coat (Wool)" })
        ).toBeInTheDocument();
        expect(screen.getByText("(W")).toHaveProperty("tagName", "STRONG");
    });

    it("API が失敗したらサジェストを空にする", async () => {
        // Arrange
        const errorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        respondWith({ error: "Internal Server Error" }, false);
        renderSearch();

        // Act
        await typeQuery("coat");

        // Assert
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        errorSpy.mockRestore();
    });
});
