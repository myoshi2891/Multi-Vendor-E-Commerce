/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SalesChart } from "@/components/dashboard/admin/sales-chart";
import type { SalesPoint } from "@/queries/dashboard";

// AreaChart は SVG/Canvas を多用するため jsdom では動作しない。タイトル検証で十分。
jest.mock("@tremor/react", () => ({
    AreaChart: () => <div data-testid="area-chart" />,
}));

const sampleData: SalesPoint[] = [
    { label: "2024-01", revenue: 100 },
    { label: "2024-02", revenue: 200 },
];

describe("SalesChart", () => {
    it("正常系: period='monthly' のとき「直近 12 ヶ月の売上推移」を表示する", () => {
        // Arrange & Act
        render(<SalesChart data={sampleData} period="monthly" />);

        // Assert
        expect(screen.getByText("直近 12 ヶ月の売上推移")).toBeInTheDocument();
        expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    });

    it("正常系: period='daily' のとき「直近 30 日の売上推移」を表示する", () => {
        // Arrange & Act — period === "daily" 分岐をカバー
        render(<SalesChart data={sampleData} period="daily" />);

        // Assert
        expect(screen.getByText("直近 30 日の売上推移")).toBeInTheDocument();
    });

    it("正常系: デフォルト period は monthly になる", () => {
        // Arrange & Act — period 省略
        render(<SalesChart data={sampleData} />);

        // Assert
        expect(screen.getByText("直近 12 ヶ月の売上推移")).toBeInTheDocument();
    });

    it("正常系: データが空の場合でも描画エラーにならない", () => {
        // Arrange & Act
        render(<SalesChart data={[]} period="monthly" />);

        // Assert
        expect(screen.getByText("直近 12 ヶ月の売上推移")).toBeInTheDocument();
        expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    });
});
