/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StoreRecentOrders } from "@/components/dashboard/seller/store-recent-orders";
import type { getStoreRecentOrders } from "@/queries/store-dashboard";
import { Prisma } from "@prisma/client";

type StoreRecentOrder = Awaited<
    ReturnType<typeof getStoreRecentOrders>
>[number];

// F1 最近の注文: OrderGroup 行から id 先頭 8 桁・日付・合計（Decimal→整形）を描画し、
// 空配列ではゼロ件文言を出すことを検証する（AC-F1-5）。コンポーネントは id/createdAt/total
// のみ参照するため、最小限のフィールドを持つ行を unknown 経由でキャストする（any 禁止）。
describe("StoreRecentOrders", () => {
    function makeOrder(
        id: string,
        createdAt: Date,
        total: number
    ): StoreRecentOrder {
        return {
            id,
            createdAt,
            total: new Prisma.Decimal(total),
        } as unknown as StoreRecentOrder;
    }

    it("renders order id prefix, date and formatted total", () => {
        // Arrange
        const orders = [
            makeOrder("abcdef1234567890", new Date("2026-06-01T00:00:00Z"), 199.5),
        ];

        // Act
        render(<StoreRecentOrders orders={orders} />);

        // Assert
        expect(screen.getByText("#abcdef12")).toBeInTheDocument();
        expect(screen.getByText("$199.50")).toBeInTheDocument();
    });

    it("renders an empty-state message when there are no orders (AC-F1-5)", () => {
        // Arrange / Act
        render(<StoreRecentOrders orders={[]} />);

        // Assert
        expect(screen.getByText("注文がありません。")).toBeInTheDocument();
    });
});
