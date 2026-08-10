/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import CategoriesMenu from "@/components/store/layout/categories-header/categories-menu";
import { createMockCategory } from "@/config/test-fixtures";
import type { Category } from "@prisma/client";

const categories = [
    createMockCategory({ id: "c1", name: "Electronics", url: "electronics" }),
    createMockCategory({
        id: "c2",
        name: "Fashion",
        url: "fashion",
        image: "https://example.com/fashion.jpg",
    }),
] as unknown as Category[];

/**
 * CategoriesMenu をレンダリングし、open state を制御する setOpen スパイを返す。
 * @param open トリガーの展開状態
 */
const renderMenu = (open = false) => {
    const setOpen = jest.fn();
    const utils = render(
        <CategoriesMenu categories={categories} open={open} setOpen={setOpen} />
    );
    return { ...utils, setOpen };
};

describe("CategoriesMenu", () => {
    it("カテゴリを list / listitem マークアップで描画する（WCAG 1.3.1）", () => {
        // Arrange & Act
        renderMenu();

        // Assert: <ul> 直下は <li> のみ（axe: list / listitem 違反の回帰防止）
        const list = screen.getByRole("list");
        const items = within(list).getAllByRole("listitem");
        expect(items).toHaveLength(2);
        items.forEach((item) => {
            expect(item.parentElement).toBe(list);
        });
    });

    it("各カテゴリを browse への遷移リンクとして提示する", () => {
        // Arrange & Act
        renderMenu();

        // Assert
        expect(
            screen.getByRole("link", { name: /Electronics/ })
        ).toHaveAttribute("href", "/browse?category=electronics");
        expect(screen.getByRole("link", { name: /Fashion/ })).toHaveAttribute(
            "href",
            "/browse?category=fashion"
        );
        expect(screen.getByAltText("Fashion")).toBeInTheDocument();
    });

    it("マウス進入で setOpen(true) を呼び、遅延後にドロップダウンを可視化する", () => {
        // Arrange
        jest.useFakeTimers();
        try {
            const { container, setOpen } = renderMenu();
            const root = container.firstElementChild as HTMLElement;

            // Act
            fireEvent.mouseEnter(root);

            // Assert: トリガー展開が終わるまでドロップダウンは閉じたまま
            expect(setOpen).toHaveBeenCalledWith(true);
            expect(screen.getByRole("list")).toHaveClass(
                "max-h-0",
                "opacity-0"
            );

            // Act: 100ms 経過で可視化
            act(() => {
                jest.advanceTimersByTime(100);
            });

            // Assert
            expect(screen.getByRole("list")).toHaveClass(
                "max-h-[523px]",
                "opacity-100"
            );
        } finally {
            jest.useRealTimers();
        }
    });

    it("マウス離脱で setOpen(false) を呼び、ドロップダウンを即時に閉じる", () => {
        // Arrange
        jest.useFakeTimers();
        try {
            const { container, setOpen } = renderMenu(true);
            const root = container.firstElementChild as HTMLElement;
            fireEvent.mouseEnter(root);
            act(() => {
                jest.advanceTimersByTime(100);
            });

            // Act
            fireEvent.mouseLeave(root);

            // Assert: setTimeout を待たず閉じる
            expect(setOpen).toHaveBeenLastCalledWith(false);
            expect(screen.getByRole("list")).toHaveClass(
                "max-h-0",
                "opacity-0"
            );
        } finally {
            jest.useRealTimers();
        }
    });

    it("open=true のときトリガーに展開スタイルを適用する", () => {
        // Arrange & Act
        renderMenu(true);

        // Assert: "All Categories" ラベルを内包する要素がトリガー本体
        const trigger = screen.getByText("All Categories").parentElement;
        expect(trigger).toHaveClass("w-[256px]");
        expect(trigger).not.toHaveClass("scale-75");
    });
});
