/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

    it("100ms 以内にマウスが離脱した場合はドロップダウンを開かない", () => {
        // Arrange
        jest.useFakeTimers();
        try {
            const { container } = renderMenu();
            const root = container.firstElementChild as HTMLElement;

            // Act: 表示タイマーが発火する前に離脱する
            fireEvent.mouseEnter(root);
            fireEvent.mouseLeave(root);
            act(() => {
                jest.advanceTimersByTime(100);
            });

            // Assert: 保留中タイマーが破棄され、開き直さない
            expect(screen.getByRole("list")).toHaveClass(
                "max-h-0",
                "opacity-0"
            );
        } finally {
            jest.useRealTimers();
        }
    });

    it.each([
        ["Enter", "{Enter}"],
        ["Space", " "],
    ])("キーボード（%s）でトリガーを開ける（WCAG 2.1.1）", async (_, keys) => {
        // Arrange
        const user = userEvent.setup();
        const { setOpen } = renderMenu();

        // Act: 実ボタンなのでフォーカスして打鍵するだけで活性化する
        await user.tab();
        await user.keyboard(keys);

        // Assert: 可視ラベルが xl 未満で hidden になっても Accessible Name が
        // 残ること（WCAG 4.1.2 / axe: button-name の回帰防止）。
        //
        // **name 指定のロール検索だけでは守れない**: jsdom は Tailwind の CSS を
        // 評価しないため `hidden xl:inline-flex` が効かず、span のテキストが
        // 常に Accessible Name として計算される —— aria-label を外しても緑のまま
        // になる（実測済み）。実ブラウザでのみ壊れる差分なので、名前の供給源で
        // ある aria-label 属性そのものを固定する。
        const trigger = screen.getByRole("button", { name: "All Categories" });
        expect(trigger).toHaveFocus();
        expect(trigger).toHaveAttribute("aria-label", "All Categories");
        expect(setOpen).toHaveBeenCalledWith(true);
    });

    it("クリックでトリガーを開閉できる", async () => {
        // Arrange
        const user = userEvent.setup();
        const { setOpen } = renderMenu(true);

        // Act: open=true から閉じる
        await user.click(screen.getByRole("button"));

        // Assert
        expect(setOpen).toHaveBeenCalledWith(false);
    });

    it("open=true のときトリガーは aria-expanded=true を公開する", () => {
        // Arrange & Act
        renderMenu(true);

        // Assert
        expect(screen.getByRole("button")).toHaveAttribute(
            "aria-expanded",
            "true"
        );
    });

    it("閉じているドロップダウンをフォーカス順から外す", () => {
        // Arrange & Act
        renderMenu();

        // Assert: max-h-0 だけでは高さ 0 でもリンクがフォーカス可能なまま残る
        expect(screen.getByRole("list")).toHaveClass("invisible");
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
