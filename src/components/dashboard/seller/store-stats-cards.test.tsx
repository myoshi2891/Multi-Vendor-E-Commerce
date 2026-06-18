/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StoreStatsCards } from "@/components/dashboard/seller/store-stats-cards";
import type { StoreDashboardStats } from "@/queries/store-dashboard";

// F1 店舗 KPI カード: StoreDashboardStats の各値を「ラベル → 整形済み値」で描画する
// マッピングを検証する。特に金額整形（2 桁）とゼロ件（AC-F1-5）の破綻なし描画。
describe("StoreStatsCards", () => {
    /**
     * ラベルを起点に同じカード内の値テキストを取得する。
     * ラベルは CardTitle（div）、値は CardContent 内の <p>。両者は Card ルート div の
     * 子孫なので、<p> を含む最近接の祖先まで遡って値ノードを得る。
     */
    function valueForLabel(label: string): string {
        let card: HTMLElement | null = screen.getByText(label).parentElement;
        while (card && card.querySelector("p") === null) {
            card = card.parentElement;
        }
        const valueNode = card?.querySelector("p");
        if (!valueNode) throw new Error(`value not found for label: ${label}`);
        return valueNode.textContent ?? "";
    }

    it("renders each KPI with formatted values", () => {
        // Arrange
        const stats: StoreDashboardStats = {
            totalRevenue: 12345.6,
            totalOrders: 42,
            totalViews: 1000,
            totalSales: 88,
            totalProducts: 17,
            lowStockCount: 3,
        };

        // Act
        render(<StoreStatsCards stats={stats} />);

        // Assert
        expect(valueForLabel("総売上")).toBe("$12,345.60");
        expect(valueForLabel("総注文数")).toBe("42");
        expect(valueForLabel("総閲覧数")).toBe("1,000");
        expect(valueForLabel("販売数")).toBe("88");
        expect(valueForLabel("総商品数")).toBe("17");
        expect(valueForLabel("在庫アラート")).toBe("3");
    });

    it("renders all zeros without breaking for an empty store (AC-F1-5)", () => {
        // Arrange
        const stats: StoreDashboardStats = {
            totalRevenue: 0,
            totalOrders: 0,
            totalViews: 0,
            totalSales: 0,
            totalProducts: 0,
            lowStockCount: 0,
        };

        // Act
        render(<StoreStatsCards stats={stats} />);

        // Assert
        expect(valueForLabel("総売上")).toBe("$0.00");
        expect(valueForLabel("総注文数")).toBe("0");
        expect(valueForLabel("在庫アラート")).toBe("0");
    });
});
