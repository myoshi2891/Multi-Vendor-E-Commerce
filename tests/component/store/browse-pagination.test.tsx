/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BrowsePagination from "@/components/store/browse-page/browse-pagination";
import { useRouter, useSearchParams } from "next/navigation";

// next/navigation は App Router のランタイム依存のため jsdom では動作しない。
// 使用する 2 フックのみをモックし、BrowsePagination の URL 組み立てを検証する。
jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
    useSearchParams: jest.fn(),
}));

const mockPush = jest.fn();

/**
 * BrowsePagination をレンダリングする。
 * @param page 現在のページ番号（1 始まり）
 * @param totalPages 総ページ数
 * @param search 初期クエリ文字列（例: "sort=top-rated&page=2"）
 */
const renderPagination = (page: number, totalPages: number, search = "") => {
    (useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams(search) as unknown as ReturnType<
            typeof useSearchParams
        >
    );
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    return render(<BrowsePagination page={page} totalPages={totalPages} />);
};

describe("BrowsePagination", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("ページ番号クリックで値形式の setPage を URL へ反映する", () => {
        // Arrange
        renderPagination(1, 3);

        // Act
        fireEvent.click(screen.getByText("3"));

        // Assert
        expect(mockPush).toHaveBeenCalledWith("/browse?page=3");
    });

    it("Next クリックで関数形式の setPage を現在ページから解決する", () => {
        // Arrange
        renderPagination(2, 5);

        // Act
        fireEvent.click(screen.getByText("Next"));

        // Assert: prev => prev + 1 が page=2 を基準に解決される
        expect(mockPush).toHaveBeenCalledWith("/browse?page=3");
    });

    it("Previous クリックで関数形式の setPage を現在ページから解決する", () => {
        // Arrange
        renderPagination(3, 5);

        // Act
        fireEvent.click(screen.getByText("Previous"));

        // Assert
        expect(mockPush).toHaveBeenCalledWith("/browse?page=2");
    });

    it("既存クエリを保持したまま page のみ差し替える", () => {
        // Arrange
        renderPagination(1, 2, "category=shoes&sort=top-rated&page=1");

        // Act
        fireEvent.click(screen.getByText("2"));

        // Assert: フィルタ・ソートが維持される（このラッパーの存在理由）
        expect(mockPush).toHaveBeenCalledWith(
            "/browse?category=shoes&sort=top-rated&page=2"
        );
    });

    it("先頭ページで Previous を押しても遷移しない", () => {
        // Arrange
        renderPagination(1, 3);

        // Act
        fireEvent.click(screen.getByText("Previous"));

        // Assert
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("最終ページで Next を押しても遷移しない", () => {
        // Arrange
        renderPagination(3, 3);

        // Act
        fireEvent.click(screen.getByText("Next"));

        // Assert
        expect(mockPush).not.toHaveBeenCalled();
    });
});
