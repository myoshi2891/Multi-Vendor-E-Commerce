/** @jest-environment jsdom */
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrdersTable, { type OrderHistoryEntry } from "./orders-table";
import userEvent from "@testing-library/user-event";
import { getUserOrdersForDisplay } from "@/queries/profile";
import OrdersPage from "./orders-page";
import OrdersLoading from "@/app/(store)/profile/orders/loading";

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

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock("@/queries/profile", () => ({
    getUserOrdersForDisplay: jest.fn(),
}));
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

/** RSC 境界を通った後の形（Decimal ではなく素の値）で 1 件の注文を組み立てる */
const buildSerializedOrder = (total: number | string): OrderHistoryEntry =>
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
    }) as unknown as OrderHistoryEntry;

describe("OrdersTable", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getUserOrdersForDisplay as jest.Mock).mockResolvedValue({
            orders: [],
            totalPages: 1,
        });
    });

    it("renders the total when it arrives as a serialized number", () => {
        render(
            <OrdersTable
                orders={[buildSerializedOrder(25.5)]}
                totalPages={1}
                fetchOrdersAction={jest.fn()}
            />
        );

        expect(screen.getByText("$25.50")).toBeInTheDocument();
    });

    it("renders the total when it arrives as a serialized string", () => {
        // Decimal は JSON 化の実装次第で文字列にもなる。どちらでも落ちてはいけない。
        render(
            <OrdersTable
                orders={[buildSerializedOrder("25.50")]}
                totalPages={1}
                fetchOrdersAction={jest.fn()}
            />
        );

        expect(screen.getByText("$25.50")).toBeInTheDocument();
    });
});

const result = { orders: [buildSerializedOrder(25.5)], totalPages: 2 };
function setup(extra = {}) {
    const fetchOrdersAction = jest.fn().mockResolvedValue(result);
    const props = { ...result, fetchOrdersAction, ...extra };
    render(<OrdersTable {...props} />);
    return { fetchOrdersAction, user: userEvent.setup() };
}

describe("branded order history", () => {
    it("provides a heading, an empty collection link and named filters", () => {
        setup({ orders: [], totalPages: 0 });
        expect(
            screen.getByRole("heading", { name: "My orders", level: 1 })
        ).toBeVisible();
        expect(
            screen.getByRole("heading", { name: "No orders yet" })
        ).toBeVisible();
        expect(
            screen.getByRole("link", { name: "Explore the collection" })
        ).toHaveAttribute("href", "/browse");
        expect(
            screen.getByRole("button", { name: "View all" })
        ).toHaveAttribute("aria-pressed", "true");
        expect(
            screen.getByRole("combobox", { name: "Order period" })
        ).toBeVisible();
    });
    it("submits searches including clearing the search and resets paging", async () => {
        const { user, fetchOrdersAction } = setup();
        await user.click(screen.getByRole("button", { name: "Next page" }));
        await waitFor(() =>
            expect(fetchOrdersAction).toHaveBeenLastCalledWith("", "", "", 2)
        );
        await user.type(
            screen.getByRole("searchbox", { name: "Search orders" }),
            "coat"
        );
        await user.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() =>
            expect(fetchOrdersAction).toHaveBeenLastCalledWith(
                "",
                "",
                "coat",
                1
            )
        );
        await user.clear(
            screen.getByRole("searchbox", { name: "Search orders" })
        );
        await user.keyboard("{Enter}");
        await waitFor(() =>
            expect(fetchOrdersAction).toHaveBeenLastCalledWith("", "", "", 1)
        );
    });
    it("preserves active conditions on paging and clears the period too", async () => {
        const { user, fetchOrdersAction } = setup({ prev_filter: "shipped" });
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Order period" }),
            "last-1-year"
        );
        await waitFor(() =>
            expect(fetchOrdersAction).toHaveBeenLastCalledWith(
                "shipped",
                "last-1-year",
                "",
                1
            )
        );
        await user.click(screen.getByRole("button", { name: "Next page" }));
        await waitFor(() =>
            expect(fetchOrdersAction).toHaveBeenLastCalledWith(
                "shipped",
                "last-1-year",
                "",
                2
            )
        );
        await user.click(
            screen.getByRole("button", { name: "Remove all filters" })
        );
        await waitFor(() =>
            expect(fetchOrdersAction).toHaveBeenLastCalledWith("", "", "", 1)
        );
        expect(
            screen.getByRole("combobox", { name: "Order period" })
        ).toHaveValue("");
    });
    it("locks pending controls, hides stale results and retries the failed conditions", async () => {
        let rejectRequest!: (error: Error) => void;
        const pending = new Promise<never>((_, reject) => {
            rejectRequest = reject;
        });
        const fetchOrdersAction = jest
            .fn()
            .mockReturnValueOnce(pending)
            .mockResolvedValue(result);
        const { user } = setup({ fetchOrdersAction });
        await user.click(screen.getByRole("button", { name: "To pay" }));
        expect(screen.getByRole("status")).toHaveTextContent("Loading orders");
        expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
        expect(screen.queryByText("$25.50")).not.toBeInTheDocument();
        await act(async () =>
            rejectRequest(new Error("internal database details"))
        );
        expect(screen.getByRole("alert")).toHaveTextContent(
            "We couldn’t load your orders"
        );
        expect(
            screen.queryByText("internal database details")
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        await waitFor(() => expect(screen.getByText("$25.50")).toBeVisible());
        expect(fetchOrdersAction).toHaveBeenLastCalledWith("unpaid", "", "", 1);
    });
    it("exposes readable initial errors with retry and distinct detail links", async () => {
        const { user, fetchOrdersAction } = setup({ initialError: true });
        expect(screen.getByRole("alert")).toBeVisible();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        await waitFor(() => expect(fetchOrdersAction).toHaveBeenCalled());
        expect(
            screen.getByRole("link", { name: "View order order-001" })
        ).toHaveAttribute("href", "/order/order-001");
        expect(
            screen.getByRole("button", { name: "Previous page" })
        ).toBeDisabled();
    });
});

describe("server and loading boundary regression", () => {
    beforeEach(() => jest.clearAllMocks());
    it("renders initial lookup failure without exposing its details", async () => {
        (getUserOrdersForDisplay as jest.Mock).mockRejectedValueOnce(
            new Error("private database details")
        );
        render(await OrdersPage({ filter: "unpaid" }));
        expect(screen.getByRole("alert")).toHaveTextContent(
            "We couldn’t load your orders"
        );
        expect(
            screen.queryByText("private database details")
        ).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "To pay" })).toHaveAttribute(
            "aria-pressed",
            "true"
        );
    });
    it("does not refetch successful initial orders during hydration", async () => {
        (getUserOrdersForDisplay as jest.Mock).mockResolvedValueOnce(result);
        render(await OrdersPage({ filter: "delivered" }));
        expect(getUserOrdersForDisplay).toHaveBeenCalledTimes(1);
        expect(getUserOrdersForDisplay).toHaveBeenCalledWith("delivered");
        expect(screen.getByText("$25.50")).toBeVisible();
    });
    it("announces route loading with the shared heading", () => {
        render(<OrdersLoading />);
        expect(
            screen.getByRole("heading", { name: "My orders", level: 1 })
        ).toBeVisible();
        expect(screen.getByRole("status")).toHaveTextContent("Loading orders");
        expect(
            screen.getByRole("region", { name: "Order history" })
        ).toHaveAttribute("aria-busy", "true");
    });
});
