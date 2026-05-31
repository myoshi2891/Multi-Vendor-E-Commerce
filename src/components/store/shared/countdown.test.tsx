/** @jest-environment jsdom */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import Countdown from "@/components/store/shared/countdown";

describe("Countdown", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // 現在時刻を固定 (2026-01-01T00:00:00Z)
        jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("computes days/hours/minutes/seconds from the target date", () => {
        // Arrange: 現在から 1日2時間3分4秒後
        const target = new Date("2026-01-02T02:03:04Z").toISOString();

        // Act
        render(<Countdown targetDate={target} />);

        // Assert: ゼロ埋め 2 桁で各単位が表示される
        expect(screen.getByText("01")).toBeInTheDocument(); // days
        expect(screen.getByText("02")).toBeInTheDocument(); // hours
        expect(screen.getByText("03")).toBeInTheDocument(); // minutes
        expect(screen.getByText("04")).toBeInTheDocument(); // seconds
    });

    it("clamps to zero once the target date has passed", () => {
        // Arrange: 過去の日付 → difference <= 0 ブランチ
        const target = new Date("2025-12-31T23:59:59Z").toISOString();

        // Act
        render(<Countdown targetDate={target} />);

        // Assert: 全単位 00
        expect(screen.getAllByText("00")).toHaveLength(4);
    });

    it("updates every second via the interval", () => {
        // Arrange
        const target = new Date("2026-01-01T00:00:10Z").toISOString(); // 10 秒後
        render(<Countdown targetDate={target} />);
        expect(screen.getByText("10")).toBeInTheDocument();

        // Act: 3 秒進める
        act(() => {
            jest.advanceTimersByTime(3000);
        });

        // Assert: 残り 7 秒
        expect(screen.getByText("07")).toBeInTheDocument();
    });
});
