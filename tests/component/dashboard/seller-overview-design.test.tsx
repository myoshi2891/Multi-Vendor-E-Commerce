/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/page";
jest.mock("@/queries/store-dashboard", () => ({
    getStoreDashboardStats: jest.fn(async () => ({
        totalRevenue: 1234.5,
        totalOrders: 2,
        totalViews: 9,
        totalSales: 3,
        totalProducts: 1,
        lowStockCount: 0,
    })),
    getStoreSalesOverTime: jest.fn(async () => []),
    getStoreRecentOrders: jest.fn(async () => []),
    getStoreTopProducts: jest.fn(async () => []),
}));
jest.mock("@tremor/react", () => ({ AreaChart: () => <div>Chart</div> }));
it("labels the overview region, keeps KPI values and distinguishes empty sections", async () => {
    render(await Page({ params: Promise.resolve({ storeUrl: "example" }) }));
    expect(
        screen.getByRole("region", { name: "店舗ダッシュボード" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "総売上" })).toBeInTheDocument();
    expect(screen.getByText("$1,234.50")).toBeInTheDocument();
    expect(screen.getByText("注文がありません。")).toBeInTheDocument();
    expect(screen.getByText("商品がありません。")).toBeInTheDocument();
});
