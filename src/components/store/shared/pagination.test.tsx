/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Pagination from "@/components/store/shared/pagination";

describe("Pagination", () => {
    it("renders one number per page", () => {
        // Arrange & Act
        render(<Pagination page={1} totalPages={3} setPage={jest.fn()} />);

        // Assert
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("sets the page when a number is clicked", () => {
        // Arrange
        const setPage = jest.fn();
        render(<Pagination page={1} totalPages={3} setPage={setPage} />);

        // Act
        fireEvent.click(screen.getByText("2"));

        // Assert
        expect(setPage).toHaveBeenCalledWith(2);
    });

    it("decrements via Previous but not below page 1", () => {
        // Arrange: page=1 では Previous は無効 (setPage 未呼び出し)
        const setPage = jest.fn();
        render(<Pagination page={1} totalPages={3} setPage={setPage} />);

        // Act
        fireEvent.click(screen.getByText("Previous"));

        // Assert
        expect(setPage).not.toHaveBeenCalled();
    });

    it("increments via Next using a functional update", () => {
        // Arrange: page=2/totalPages=3 なら Next 有効
        const setPage = jest.fn();
        render(<Pagination page={2} totalPages={3} setPage={setPage} />);

        // Act
        fireEvent.click(screen.getByText("Next"));

        // Assert: 関数アップデータが渡る → 現在値 2 を +1 する
        expect(setPage).toHaveBeenCalledTimes(1);
        const updater = setPage.mock.calls[0][0] as (prev: number) => number;
        expect(updater(2)).toBe(3);
    });

    it("does not advance past the last page", () => {
        // Arrange: page=3/totalPages=3 なら Next は無効
        const setPage = jest.fn();
        render(<Pagination page={3} totalPages={3} setPage={setPage} />);

        // Act
        fireEvent.click(screen.getByText("Next"));

        // Assert
        expect(setPage).not.toHaveBeenCalled();
    });
});
