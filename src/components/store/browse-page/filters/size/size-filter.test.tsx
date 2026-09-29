/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FiltersQueryType } from "@/lib/types";
import { getFilteredSizes } from "@/queries/size";
import SizeFilter from "./size-filter";

jest.mock("@/queries/size", () => ({ getFilteredSizes: jest.fn() }));
jest.mock("./size-link", () => ({
    __esModule: true,
    default: ({ size }: { size: string }) => <span data-testid="size-link">{size}</span>,
}));

const mockGetFilteredSizes = getFilteredSizes as jest.MockedFunction<typeof getFilteredSizes>;
const queries = { category: "jewelry" } as unknown as FiltersQueryType;

describe("SizeFilter", () => {
    beforeEach(() => {
        mockGetFilteredSizes.mockReset();
    });

    it("絞り込み条件と storeUrl で取得したサイズを表示する", async () => {
        // Arrange
        mockGetFilteredSizes.mockResolvedValue({ sizes: [{ size: "S" }, { size: "M" }], count: 2 });

        // Act
        render(<SizeFilter queries={queries} storeUrl="my-store" />);

        // Assert
        expect(await screen.findAllByTestId("size-link")).toHaveLength(2);
        expect(mockGetFilteredSizes).toHaveBeenCalledWith(
            { category: "jewelry", subCategory: undefined, offer: undefined, storeUrl: "my-store" },
            10
        );
    });

    it("取得に失敗したらサイズを表示しない", async () => {
        // Arrange
        mockGetFilteredSizes.mockRejectedValue(new Error("DB down"));

        // Act
        render(<SizeFilter queries={queries} />);

        // Assert
        await waitFor(() => expect(mockGetFilteredSizes).toHaveBeenCalled());
        expect(screen.queryByTestId("size-link")).not.toBeInTheDocument();
    });

    it("アンマウント後に届いた結果・失敗は状態へ反映しない", async () => {
        // Arrange
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        let resolveSizes: (value: { sizes: { size: string }[]; count: number }) => void = () => {};
        let rejectSizes: (reason: Error) => void = () => {};
        mockGetFilteredSizes
            .mockReturnValueOnce(new Promise((resolve) => { resolveSizes = resolve; }))
            .mockReturnValueOnce(new Promise((_, reject) => { rejectSizes = reject; }));
        const first = render(<SizeFilter queries={queries} />);
        const second = render(<SizeFilter queries={queries} />);

        // Act
        first.unmount();
        second.unmount();
        resolveSizes({ sizes: [{ size: "S" }], count: 1 });
        rejectSizes(new Error("late"));
        await Promise.resolve();

        // Assert: cancelled ガードで破棄され、エラーログも未処理例外も出ない
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it("見出しボタンでパネルを開閉する", async () => {
        // Arrange
        mockGetFilteredSizes.mockResolvedValue({ sizes: [], count: 0 });
        render(<SizeFilter queries={queries} />);
        await waitFor(() => expect(mockGetFilteredSizes).toHaveBeenCalled());
        const toggle = screen.getByRole("button", { name: "Size" });
        const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");

        // Act & Assert
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(panel).toHaveClass("hidden");
    });
});
