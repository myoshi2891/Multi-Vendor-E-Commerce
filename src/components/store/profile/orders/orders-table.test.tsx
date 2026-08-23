/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrdersTable from "./orders-table";
import { getUserOrders } from "@/queries/profile";
import type { UserOrderType } from "@/lib/types";

/**
 * 注文履歴テーブルの金額描画。
 *
 * **RSC 境界を再現することが本テストの主題**。`orders-table.tsx` は `"use client"` で、
 * `order.total` は Server Component から渡される Prisma `Decimal` である。境界を越える際に
 * Decimal は**メソッドを失った素の値**へシリアライズされるため、`.toFixed()` を直接呼ぶと
 * `TypeError` になり**ページ全体の描画が失敗する**。
 *
 * jsdom のテストで「本物の Decimal」をモックとして渡すと、この経路は一度も踏まれない
 * （既存の `payments-table.test.tsx` が `{ toNumber: () => 1000 }` を渡していて
 * 気づけなかったのと同じ理由）。ここでは**シリアライズ後の形**（素の number / string）を渡す。
 */

jest.mock("@/queries/profile", () => ({
    getUserOrders: jest.fn(),
}));
jest.mock("./order-table-header", () => ({
    __esModule: true,
    default: () => <div data-testid="order-table-header" />,
}));
jest.mock("../../shared/pagination", () => ({
    __esModule: true,
    default: () => <div data-testid="pagination" />,
}));
jest.mock("@/components/shared/order-status", () => ({
    __esModule: true,
    default: () => <span data-testid="order-status" />,
}));
jest.mock("@/components/shared/payment-status", () => ({
    __esModule: true,
    default: () => <span data-testid="payment-status" />,
}));
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

/** RSC 境界を通った後の形（Decimal ではなく素の値）で 1 件の注文を組み立てる */
const buildSerializedOrder = (total: number | string): UserOrderType =>
    ({
        id: "order-001",
        total,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        orderStatus: "Processing",
        paymentStatus: "Pending",
        groups: [
            {
                _count: { items: 2 },
                items: [{ image: "https://example.test/a.png" }],
            },
        ],
    }) as unknown as UserOrderType;

describe("OrdersTable", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getUserOrders as jest.Mock).mockResolvedValue({
            orders: [],
            totalPages: 1,
        });
    });

    it("renders the total when it arrives as a serialized number", () => {
        render(
            <OrdersTable orders={[buildSerializedOrder(25.5)]} totalPages={1} />
        );

        expect(screen.getByText("$25.50")).toBeInTheDocument();
    });

    it("renders the total when it arrives as a serialized string", () => {
        // Decimal は JSON 化の実装次第で文字列にもなる。どちらでも落ちてはいけない。
        render(
            <OrdersTable
                orders={[buildSerializedOrder("25.50")]}
                totalPages={1}
            />
        );

        expect(screen.getByText("$25.50")).toBeInTheDocument();
    });
});
