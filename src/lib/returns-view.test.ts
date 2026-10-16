import { Prisma } from "@prisma/client";
import {
    buildGroupReturnOptions,
    serializeReturnRequests,
    type ReturnRequestRow,
    type ReturnRequestView,
} from "./returns-view";
import { ProductStatus } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const row = (overrides: Partial<ReturnRequestRow> = {}): ReturnRequestRow => ({
    id: "rma-1",
    orderGroupId: "group-1",
    status: "RECEIVED",
    resolution: "REFUND",
    customerNote: "too small",
    sellerNote: null,
    returnTrackingNumber: "TRK-1",
    refundAmount: null,
    approvedAt: new Date("2026-10-02T00:00:00Z"),
    rejectedAt: null,
    receivedAt: new Date("2026-10-03T00:00:00Z"),
    resolvedAt: null,
    canceledAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    items: [
        {
            id: "rmi-1",
            orderItemId: "item-1",
            quantity: 2,
            reasonCode: "SIZE_FIT",
            condition: null,
            restockedQuantity: 0,
            orderItem: {
                name: "Silk scarf",
                image: "/scarf.png",
                size: "M",
                price: new Prisma.Decimal("100.10"),
            },
        },
    ],
    ...overrides,
});

describe("serializeReturnRequests", () => {
    it("Decimal と Date をクライアントへ渡せる値にし、返金額の目安を Decimal で計算する", () => {
        // Act
        const [view] = serializeReturnRequests([row()]);

        // Assert
        expect(view).toMatchObject({
            id: "rma-1",
            status: "RECEIVED",
            createdAt: "2026-10-01T00:00:00.000Z",
            receivedAt: "2026-10-03T00:00:00.000Z",
            resolvedAt: null,
            refundAmount: null,
            estimatedRefund: 200.2,
            orderId: null,
        });
        expect(view?.items[0]).toEqual({
            id: "rmi-1",
            orderItemId: "item-1",
            quantity: 2,
            reasonCode: "SIZE_FIT",
            condition: null,
            restockedQuantity: 0,
            name: "Silk scarf",
            image: "/scarf.png",
            size: "M",
            price: 100.1,
        });
    });

    it("確定した返金額と、店舗キューの注文 ID を写す", () => {
        // Act
        const [view] = serializeReturnRequests([
            {
                ...row({
                    status: "RESOLVED",
                    refundAmount: new Prisma.Decimal("200.20"),
                }),
                orderGroup: { orderId: "order-9" },
            },
        ]);

        // Assert
        expect(view?.refundAmount).toBe(200.2);
        expect(view?.orderId).toBe("order-9");
    });
});

describe("buildGroupReturnOptions", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    const order = (
        itemOverrides: Partial<{ status: string; quantity: number }> = {},
        storeOverrides: Partial<{
            acceptsReturns: boolean;
            returnWindowDays: number | null;
        }> = {},
        createdAt = new Date(now.getTime() - 10 * DAY_MS)
    ) => ({
        createdAt,
        groups: [
            {
                id: "group-1",
                shippingDeliveryMax: 14,
                store: {
                    acceptsReturns: true,
                    returnWindowDays: null,
                    ...storeOverrides,
                },
                items: [
                    {
                        id: "item-1",
                        name: "Silk scarf",
                        image: "/scarf.png",
                        size: "M",
                        quantity: 3,
                        status: ProductStatus.Delivered,
                        ...itemOverrides,
                    },
                ],
            },
        ],
    });
    const view = (
        status: ReturnRequestView["status"],
        quantity: number
    ): ReturnRequestView => ({
        ...serializeReturnRequests([row({ status })])[0]!,
        items: [
            {
                ...serializeReturnRequests([row()])[0]!.items[0]!,
                quantity,
            },
        ],
    });

    it("配達済み・期限内の item を、有効な RMA の数量を引いた残りで返す（却下・取り消しは数えない）", () => {
        // Act
        const options = buildGroupReturnOptions(
            order(),
            [view("REQUESTED", 1), view("REJECTED", 2), view("CANCELED", 2)],
            now
        );

        // Assert
        expect(options["group-1"]?.items).toEqual([
            {
                id: "item-1",
                name: "Silk scarf",
                image: "/scarf.png",
                size: "M",
                maxQuantity: 2,
            },
        ]);
        expect(options["group-1"]?.requests).toHaveLength(3);
        // 期限 = 注文日 + 14 日 + 既定の 30 日
        expect(options["group-1"]?.deadline).toBe(
            new Date(now.getTime() + 34 * DAY_MS).toISOString()
        );
    });

    it("全数が申請済みの item は出さない", () => {
        const options = buildGroupReturnOptions(
            order(),
            [view("APPROVED", 3)],
            now
        );
        expect(options["group-1"]?.items).toEqual([]);
    });

    it.each([
        ["未配達", order({ status: ProductStatus.Shipped })],
        ["返品を受け付けない店舗", order({}, { acceptsReturns: false })],
        [
            "期限切れ",
            order(
                {},
                { returnWindowDays: 1 },
                new Date(now.getTime() - 16 * DAY_MS)
            ),
        ],
    ])("%s の item は申請できない", (_label, input) => {
        const options = buildGroupReturnOptions(input, [], now);
        expect(options["group-1"]?.items).toEqual([]);
    });

    it("RMA は orderGroupId で group に振り分ける", () => {
        const other = { ...view("REQUESTED", 1), orderGroupId: "group-x" };
        const options = buildGroupReturnOptions(order(), [other], now);
        expect(options["group-1"]?.requests).toEqual([]);
    });
});
