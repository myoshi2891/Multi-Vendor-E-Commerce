/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductSort from "@/components/store/browse-page/sort";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// next/navigation は App Router のランタイム依存のため jsdom では動作しない。
// 3 フックのみをモックし、ProductSort の URL 組み立てロジックを検証する。
jest.mock("next/navigation", () => ({
    usePathname: jest.fn(),
    useRouter: jest.fn(),
    useSearchParams: jest.fn(),
}));

const mockReplace = jest.fn();

/**
 * ProductSort をレンダリングする。
 * @param search 初期クエリ文字列（例: "sort=top-rated&category=shoes"）
 */
const renderSort = (search = "") => {
    (useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams(search) as unknown as ReturnType<
            typeof useSearchParams
        >
    );
    (usePathname as jest.Mock).mockReturnValue("/browse");
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    return render(<ProductSort />);
};

/** Radix のトリガーはキーボード（Enter）でも開く。pointer capture 非対応の jsdom で安定。 */
const openMenu = () => {
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    return screen.getByRole("menu");
};

describe("ProductSort", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("sort パラメータが無い場合は Most Popular を表示する", () => {
        // Arrange & Act
        renderSort();

        // Assert
        expect(screen.getByRole("button")).toHaveTextContent("Most Popular");
    });

    it("sort パラメータに対応するラベルを表示する", () => {
        // Arrange & Act
        renderSort("sort=price-high-to-low");

        // Assert
        expect(screen.getByRole("button")).toHaveTextContent(
            "Price High to low"
        );
    });

    it("未知の sort 値では既定ラベルへフォールバックする", () => {
        // Arrange & Act
        renderSort("sort=unknown-sort");

        // Assert: find が undefined でもアクセシブル名が欠落しない
        expect(
            screen.getByRole("button", { name: "Sort by Most Popular" })
        ).toBeInTheDocument();
    });

    it("未知の sort 値では既定項目が選択状態になる", () => {
        // Arrange
        renderSort("sort=unknown-sort");

        // Act
        const menu = openMenu();

        // Assert: 表示ラベルと選択状態が一致する（未正規化だと全項目 false）
        expect(
            within(menu).getByRole("menuitemradio", { name: "Most Popular" })
        ).toHaveAttribute("aria-checked", "true");
    });

    it("可視ラベル Sort by と現在値を合成したアクセシブル名を持つ", () => {
        // Arrange & Act
        renderSort("sort=top-rated");

        // Assert: aria-labelledby が "Sort by" + 現在値を指す
        expect(
            screen.getByRole("button", { name: "Sort by Top Rated" })
        ).toBeInTheDocument();
    });

    it("トリガー操作でメニューを開き、全ソート項目を radio として提示する", () => {
        // Arrange
        renderSort();

        // Act
        const menu = openMenu();

        // Assert
        const items = within(menu).getAllByRole("menuitemradio");
        expect(items).toHaveLength(5);
        expect(items.map((item) => item.textContent)).toEqual([
            "Most Popular",
            "New Arrivals",
            "Top Rated",
            "Price low to high",
            "Price High to low",
        ]);
    });

    it("選択中の項目のみ aria-checked=true かつ太字になる", () => {
        // Arrange
        renderSort("sort=top-rated");

        // Act
        const menu = openMenu();

        // Assert
        const selected = within(menu).getByRole("menuitemradio", {
            name: "Top Rated",
        });
        expect(selected).toHaveAttribute("aria-checked", "true");
        expect(within(selected).getByText("Top Rated")).toHaveClass(
            "font-bold"
        );

        const other = within(menu).getByRole("menuitemradio", {
            name: "New Arrivals",
        });
        expect(other).toHaveAttribute("aria-checked", "false");
        expect(within(other).getByText("New Arrivals")).not.toHaveClass(
            "font-bold"
        );
    });

    it("項目を選択すると sort クエリを付与して replace する", () => {
        // Arrange
        renderSort();
        const menu = openMenu();

        // Act
        fireEvent.click(
            within(menu).getByRole("menuitemradio", { name: "New Arrivals" })
        );

        // Assert
        expect(mockReplace).toHaveBeenCalledWith("/browse?sort=new-arrivals");
    });

    it("既存クエリを保持したまま sort のみ差し替える", () => {
        // Arrange
        renderSort("category=shoes&sort=top-rated");
        const menu = openMenu();

        // Act
        fireEvent.click(
            within(menu).getByRole("menuitemradio", {
                name: "Price low to high",
            })
        );

        // Assert
        expect(mockReplace).toHaveBeenCalledWith(
            "/browse?category=shoes&sort=price-low-to-high"
        );
    });
});
