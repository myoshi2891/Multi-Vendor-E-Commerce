/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StatsCards } from "@/components/dashboard/admin/stats-cards";
import type { AdminDashboardStats } from "@/queries/dashboard";

const defaultStats: AdminDashboardStats = {
    totalRevenue: 500.5,
    totalOrders: 10,
    activeStores: 3,
    pendingStores: 2,
    totalUsers: 50,
    totalProducts: 120,
    totalCategories: 5,
    totalSubCategories: 15,
};

describe("StatsCards", () => {
    it("正常系: stats を受け取りすべての KPI カードを描画する", () => {
        // Arrange & Act
        render(<StatsCards stats={defaultStats} />);

        // Assert — 8 ラベルが DOM に存在
        expect(screen.getByText("総売上")).toBeInTheDocument();
        expect(screen.getByText("総注文数")).toBeInTheDocument();
        expect(screen.getByText("アクティブ店舗")).toBeInTheDocument();
        expect(screen.getByText("審査中店舗")).toBeInTheDocument();
        expect(screen.getByText("総ユーザー数")).toBeInTheDocument();
        expect(screen.getByText("総商品数")).toBeInTheDocument();
        expect(screen.getByText("カテゴリ数")).toBeInTheDocument();
        expect(screen.getByText("サブカテゴリ数")).toBeInTheDocument();
    });

    it("正常系: totalRevenue を '$500.50' 形式でフォーマットする", () => {
        // Arrange & Act
        render(<StatsCards stats={defaultStats} />);

        // Assert
        expect(screen.getByText("$500.50")).toBeInTheDocument();
    });

    it("正常系: 各数値カードの値を正しく描画する", () => {
        // Arrange & Act
        render(<StatsCards stats={defaultStats} />);

        // Assert
        expect(screen.getByText("10")).toBeInTheDocument();   // totalOrders
        expect(screen.getByText("3")).toBeInTheDocument();    // activeStores
        expect(screen.getByText("2")).toBeInTheDocument();    // pendingStores
        expect(screen.getByText("50")).toBeInTheDocument();   // totalUsers
        expect(screen.getByText("120")).toBeInTheDocument();  // totalProducts
        expect(screen.getByText("5")).toBeInTheDocument();    // totalCategories
        expect(screen.getByText("15")).toBeInTheDocument();   // totalSubCategories
    });
});
