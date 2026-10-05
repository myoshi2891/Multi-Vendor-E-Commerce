/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/dashboard/admin/page";
import * as queries from "@/queries/dashboard";
jest.mock("@/queries/dashboard", () => ({
    getAdminDashboardStats: jest.fn(),
    getSalesOverTime: jest.fn(),
    getRecentOrders: jest.fn(),
    getRecentStores: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@tremor/react", () => ({ AreaChart: () => <p>Chart</p> }));
const stats = {
    totalRevenue: 12.5,
    totalOrders: 3,
    activeStores: 1,
    pendingStores: 2,
    totalUsers: 5,
    totalProducts: 10,
    totalCategories: 2,
    totalSubCategories: 0,
};
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(queries.getAdminDashboardStats).mockResolvedValue(stats);
    jest.mocked(queries.getSalesOverTime).mockResolvedValue([]);
    jest.mocked(queries.getRecentOrders).mockResolvedValue([]);
    jest.mocked(queries.getRecentStores).mockResolvedValue([]);
});
it("provides an administration region and h2 metric/activity headings", async () => {
    render(await Page());
    expect(
        screen.getByRole("region", { name: "ダッシュボード" })
    ).toContainElement(
        screen.getByRole("heading", { level: 1, name: "ダッシュボード" })
    );
    expect(screen.getByText("Administration")).toBeVisible();
    expect(
        screen.getByRole("heading", { level: 2, name: "総売上" })
    ).toBeVisible();
    expect(
        screen.getByRole("heading", { level: 2, name: "最近の注文" })
    ).toBeVisible();
    expect(screen.getByText("$12.50")).toBeVisible();
    expect(screen.getByText("売上データがありません。")).toBeVisible();
});
it("distinguishes fetch failure from empty metrics and provides retry", async () => {
    jest.mocked(queries.getAdminDashboardStats).mockRejectedValueOnce(
        new Error("private database detail")
    );
    render(await Page());
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
    expect(
        screen.queryByText("private database detail")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
});
