/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DismissibleDetails from "@/components/store/layout/header/dismissible-details";

/**
 * ヘッダーの検索 / メニューパネル（`src/components/store/layout/header/dismissible-details.tsx`）。
 *
 * ネイティブ `<details>` に「外側タップ・Escape・パネル内リンク遷移・フォーム送信」で
 * 閉じる挙動を足している。リンク遷移やフォーム送信後に開いたまま残ると、
 * クライアント遷移後もパネルが画面を覆い続けるため、閉じる経路を個別に固定する。
 */

const renderPanel = () =>
    render(
        <>
            <button type="button">outside</button>
            <DismissibleDetails className="relative">
                <summary>Open menu</summary>
                <a href="#collection">Collection</a>
                <span>Plain text</span>
                <form onSubmit={(event) => event.preventDefault()}>
                    <input aria-label="Search products" />
                    <button type="submit">Search</button>
                </form>
            </DismissibleDetails>
        </>
    );

const openDetails = (): HTMLDetailsElement => {
    const details = screen.getByText("Open menu").closest("details");
    if (!(details instanceof HTMLDetailsElement)) {
        throw new Error("details 要素が見つかりません");
    }
    details.open = true;
    return details;
};

describe("DismissibleDetails", () => {
    it("className を details 要素へ渡す", () => {
        // Arrange & Act
        renderPanel();

        // Assert
        expect(openDetails()).toHaveClass("relative");
    });

    it("パネル内のリンクをクリックすると閉じる", () => {
        // Arrange
        renderPanel();
        const details = openDetails();

        // Act
        fireEvent.click(screen.getByRole("link", { name: "Collection" }));

        // Assert
        expect(details.open).toBe(false);
    });

    it("リンク以外の要素をクリックしても開いたまま", () => {
        // Arrange
        renderPanel();
        const details = openDetails();

        // Act
        fireEvent.click(screen.getByText("Plain text"));

        // Assert
        expect(details.open).toBe(true);
    });

    it("パネル内のフォームを送信すると閉じる", () => {
        // Arrange
        renderPanel();
        const details = openDetails();

        // Act
        fireEvent.submit(
            screen.getByRole("textbox", { name: "Search products" })
        );

        // Assert
        expect(details.open).toBe(false);
    });

    it("外側を pointerdown すると閉じ、内側では閉じない", () => {
        // Arrange
        renderPanel();
        const details = openDetails();

        // Act & Assert
        fireEvent.pointerDown(screen.getByText("Plain text"));
        expect(details.open).toBe(true);
        fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
        expect(details.open).toBe(false);
    });

    it("Escape で閉じて summary へフォーカスを戻す", () => {
        // Arrange
        renderPanel();
        const details = openDetails();

        // Act
        fireEvent.keyDown(document, { key: "Escape" });

        // Assert
        expect(details.open).toBe(false);
        expect(screen.getByText("Open menu")).toHaveFocus();
    });

    it("入れ子で両方開いている時の Escape は内側だけを閉じる", () => {
        // Arrange: ヘッダーのメニュー内に国/言語セレクターが入る構成
        render(
            <DismissibleDetails>
                <summary>Open menu</summary>
                <DismissibleDetails>
                    <summary>Open selector</summary>
                </DismissibleDetails>
            </DismissibleDetails>
        );
        const outer = screen.getByText("Open menu").closest("details");
        const inner = screen.getByText("Open selector").closest("details");
        if (!outer || !inner) throw new Error("details 要素が見つかりません");
        outer.open = true;
        inner.open = true;

        // Act
        fireEvent.keyDown(document, { key: "Escape" });

        // Assert
        expect(inner.open).toBe(false);
        expect(outer.open).toBe(true);
        expect(screen.getByText("Open selector")).toHaveFocus();
    });

    it("閉じている時の Escape ではフォーカスを動かさない", () => {
        // Arrange
        renderPanel();
        const outside = screen.getByRole("button", { name: "outside" });
        outside.focus();

        // Act
        fireEvent.keyDown(document, { key: "Escape" });

        // Assert
        expect(outside).toHaveFocus();
    });

    it("アンマウント後は document のリスナーを外す", () => {
        // Arrange
        const removeSpy = jest.spyOn(document, "removeEventListener");
        const { unmount } = renderPanel();

        // Act
        unmount();

        // Assert
        expect(removeSpy).toHaveBeenCalledWith(
            "pointerdown",
            expect.any(Function)
        );
        expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
        removeSpy.mockRestore();
    });
    it("forwards the native disclosure name for exclusive panels", () => {
        render(
            <DismissibleDetails name="store-header-panel">
                <summary>Named</summary>
            </DismissibleDetails>
        );
        expect(screen.getByText("Named").closest("details")).toHaveAttribute(
            "name",
            "store-header-panel"
        );
    });
});
