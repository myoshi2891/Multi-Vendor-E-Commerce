/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RecentOrders } from "@/components/dashboard/admin/recent-orders";
import { Prisma } from "@prisma/client";

type Order = React.ComponentProps<typeof RecentOrders>["orders"][number];

const makeOrder = (overrides: Partial<Order> = {}): Order =>
    ({
        id: "order-abc12345",
        total: new Prisma.Decimal("99.99"),
        createdAt: new Date(2024, 2, 15),
        groups: [],
        shippingAddress: null,
        ...overrides,
    } as unknown as Order);

describe("RecentOrders", () => {
    it("正常系: 注文リストを描画する", () => {
        // Arrange
        const orders = [
            makeOrder({ id: "order-abc12345", total: new Prisma.Decimal("99.99") }),
            makeOrder({ id: "order-xyz67890", total: new Prisma.Decimal("200.00") }),
        ];

        // Act
        render(<RecentOrders orders={orders} />);

        // Assert — id の先頭 8 文字が表示される
        expect(screen.getByText("#order-ab")).toBeInTheDocument();
        expect(screen.getByText("#order-xy")).toBeInTheDocument();
        // 金額が "$99.99" / "$200.00" 形式で表示される
        expect(screen.getByText("$99.99")).toBeInTheDocument();
        expect(screen.getByText("$200.00")).toBeInTheDocument();
    });

    it("正常系: 空の場合「注文がありません。」を表示する", () => {
        // Arrange & Act
        render(<RecentOrders orders={[]} />);

        // Assert — orders.length === 0 の分岐
        expect(screen.getByText("注文がありません。")).toBeInTheDocument();
    });

    it("正常系: createdAt を日本語ロケールの日付でフォーマットする", () => {
        // Arrange
        const date = new Date(2024, 2, 15);
        const orders = [makeOrder({ createdAt: date })];

        // Act
        render(<RecentOrders orders={orders} />);

        // Assert — toLocaleDateString("ja-JP") の形式
        expect(screen.getByText(date.toLocaleDateString("ja-JP"))).toBeInTheDocument();
    });
});
