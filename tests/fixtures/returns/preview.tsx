import React from "react";
import Link from "next/link";
import { createRoot } from "react-dom/client";
import OrderGroups from "@/components/store/order-page/groups-container";
import ReturnRequestPanel from "@/components/store/order-page/return-request-panel";
import SellerReturns from "@/components/dashboard/seller/seller-returns";
import SellerShell from "@/components/dashboard/design/seller-shell";
import styles from "@/components/store/shared/commerce.module.css";
import {
    emptyReturnStatusCounts,
    type GroupReturnOptions,
    type ReturnRequestCustomerActions,
    type ReturnRequestSellerActions,
    type ReturnRequestView,
} from "@/lib/returns-view";
import type { ReturnRequestStatus } from "@prisma/client";
import type { OrderGroupWithItemsType } from "@/lib/types";
import {
    createMockOrderGroup,
    createMockOrderItem,
    createMockStore,
} from "@/config/test-fixtures";

const params = new URLSearchParams(location.search);
const screen = params.get("screen") ?? "order";
const scenario = params.get("scenario") ?? "";
const LONG = "An exceptionally long cashmere wrap name that keeps wrapping ";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let calls = 0;
/** ?scenario=fail は 1 回目だけ失敗し、?scenario=pending は送信中のまま止める */
async function act<T>(value: T): Promise<T> {
    await wait(scenario === "pending" ? 60_000 : 400);
    if (scenario === "fail" && ++calls === 1)
        throw new Error("Return quantity exceeds purchased quantity.");
    return value;
}

const item = (id: string, name: string, quantity = 1) => ({
    id: `rmi-${id}`,
    orderItemId: `item-${id}`,
    quantity,
    reasonCode: "DEFECTIVE" as const,
    condition: null,
    restockedQuantity: 0,
    name,
    image: "/assets/images/no_image.png",
    size: "M",
    price: 120,
});

const request = (
    id: string,
    status: ReturnRequestView["status"],
    overrides: Partial<ReturnRequestView> = {}
): ReturnRequestView => ({
    id: `rma-${id}`,
    orderGroupId: "group-0",
    orderId: "order-1234567890",
    status,
    resolution: "REFUND",
    customerNote: "The seam opened after the first wear. ".repeat(2),
    sellerNote: null,
    returnTrackingNumber: null,
    refundAmount: null,
    estimatedRefund: 240,
    createdAt: "2026-10-10T00:00:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    receivedAt: null,
    resolvedAt: null,
    canceledAt: null,
    items: [item(`${id}-a`, "Silk scarf"), item(`${id}-b`, LONG, 1)],
    ...overrides,
});

const sellerRequests: ReturnRequestView[] = [
    request("requested", "REQUESTED"),
    request("approved", "APPROVED", { returnTrackingNumber: "TRK-0042" }),
    request("received", "RECEIVED"),
    request("resolved", "RESOLVED", { refundAmount: 240 }),
    request("rejected", "REJECTED", { sellerNote: "Item shows wear." }),
    request("canceled", "CANCELED"),
];

const sellerActions: ReturnRequestSellerActions = {
    approveAction: () => act("APPROVED"),
    rejectAction: () => act("REJECTED"),
    receiveAction: () => act("RECEIVED"),
    resolveAction: () => act("RESOLVED"),
};
const customerActions: ReturnRequestCustomerActions = {
    createAction: () => act({ id: "rma-new", status: "REQUESTED" }),
    cancelAction: () => act("CANCELED"),
    trackingAction: () => act("APPROVED"),
};

const store = createMockStore({ name: "Maison Example" });
const groups = [0, 1].map((index) => ({
    ...createMockOrderGroup({
        id: `group-${index}`,
        status: "Delivered",
        subTotal: 240,
        shippingFees: 0,
        total: 240,
    }),
    coupon: null,
    store,
    _count: { items: 2 },
    items: [
        createMockOrderItem({
            id: `item-${index}-a`,
            name: "Silk scarf",
            quantity: 2,
            status: "Delivered",
        }),
        createMockOrderItem({
            id: `item-${index}-b`,
            name: LONG,
            quantity: 1,
            status: "Delivered",
        }),
    ],
})) as unknown as OrderGroupWithItemsType[];

const options: Record<string, GroupReturnOptions> = {
    "group-0": {
        groupId: "group-0",
        deadline: "2026-11-20T00:00:00.000Z",
        items: [
            {
                id: "item-0-a",
                name: "Silk scarf",
                image: "",
                size: "M",
                maxQuantity: 2,
            },
            {
                id: "item-0-b",
                name: LONG,
                image: "",
                size: "M",
                maxQuantity: 1,
            },
        ],
        requests:
            scenario === "fresh"
                ? []
                : [
                      request("approved", "APPROVED"),
                      request("rejected", "REJECTED", {
                          sellerNote: "Item shows wear.",
                      }),
                      request("resolved", "RESOLVED", { refundAmount: 240 }),
                  ],
    },
    "group-1": { groupId: "group-1", deadline: null, items: [], requests: [] },
};

// サーバーの絞り込みと状態別件数（groupBy）の代わり。?status= は useRouter().push の遷移で付く
const sellerAll = scenario === "empty" ? [] : sellerRequests;
const sellerStatus =
    (params.get("status") as ReturnRequestStatus | null) ?? null;
const sellerVisible = sellerStatus
    ? sellerAll.filter((r) => r.status === sellerStatus)
    : sellerAll;
const sellerCounts = emptyReturnStatusCounts();
for (const r of sellerAll) sellerCounts[r.status] += 1;

function App() {
    if (screen === "seller")
        return (
            <SellerShell
                sidebar={
                    <nav aria-label="Store navigation">
                        <Link href="/?screen=seller">Returns</Link>
                    </nav>
                }
                header={<span>Maison Example</span>}
            >
                <SellerReturns
                    storeUrl="maison-example"
                    requests={sellerVisible}
                    counts={sellerCounts}
                    status={sellerStatus}
                    page={1}
                    totalPages={1}
                    actions={sellerActions}
                />
            </SellerShell>
        );
    return (
        <main className={styles.page} data-order-detail>
            <h1 style={{ font: "400 40px/1.2 Georgia,serif" }}>
                Order details
            </h1>
            <div className={styles.layout}>
                <div className={styles.column}>
                    <OrderGroups
                        groups={groups}
                        returnSlots={Object.fromEntries(
                            Object.entries(options).map(([id, value]) => [
                                id,
                                <ReturnRequestPanel
                                    key={id}
                                    options={value}
                                    actions={customerActions}
                                    createIdempotencyKey={() => "fixture-key"}
                                />,
                            ])
                        )}
                    />
                </div>
            </div>
        </main>
    );
}

createRoot(document.getElementById("root")!).render(<App />);
