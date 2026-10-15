import {
    Prisma,
    type ReturnItemCondition,
    type ReturnReasonCode,
    type ReturnRequestStatus,
} from "@prisma/client";
import {
    getReturnDeadline,
    isReturnEligible,
    resolveReturnWindowDays,
} from "@/lib/returns-policy";
import { toNumberSafe } from "@/lib/utils";
import type {
    approveReturnRequest,
    cancelReturnRequest,
    createReturnRequest,
    getStoreReturnRequests,
    receiveReturnRequest,
    rejectReturnRequest,
    resolveReturnRequest,
    setReturnTrackingNumber,
} from "@/queries/returns";

/**
 * 返品 RMA の表示用の型と変換（plan 088 Step 5）。
 * Server Component で Prisma の行（Decimal / Date）をクライアントへ渡せる値にし、
 * 注文詳細で「どの item をいくつ申請できるか」を導く。判定は returns-policy.ts を再利用する。
 */

export type ReturnRequestRow = Omit<
    Awaited<ReturnType<typeof getStoreReturnRequests>>[number],
    "orderGroup"
> & { orderGroup?: { orderId: string } };

export type ReturnRequestItemView = {
    id: string;
    orderItemId: string;
    quantity: number;
    reasonCode: ReturnReasonCode;
    condition: ReturnItemCondition | null;
    restockedQuantity: number;
    name: string;
    image: string;
    size: string;
    price: number;
};

export type ReturnRequestView = {
    id: string;
    orderGroupId: string;
    orderId: string | null;
    status: ReturnRequestStatus;
    resolution: string;
    customerNote: string | null;
    sellerNote: string | null;
    returnTrackingNumber: string | null;
    refundAmount: number | null;
    estimatedRefund: number;
    createdAt: string;
    approvedAt: string | null;
    rejectedAt: string | null;
    receivedAt: string | null;
    resolvedAt: string | null;
    canceledAt: string | null;
    items: ReturnRequestItemView[];
};

export type ReturnableItem = {
    id: string;
    name: string;
    image: string;
    size: string;
    maxQuantity: number;
};

export type GroupReturnOptions = {
    groupId: string;
    deadline: string | null;
    items: ReturnableItem[];
    requests: ReturnRequestView[];
};

export type ReturnableOrder = {
    createdAt: Date;
    groups: {
        id: string;
        shippingDeliveryMax: number;
        store: { acceptsReturns: boolean; returnWindowDays: number | null };
        items: {
            id: string;
            name: string;
            image: string;
            size: string;
            quantity: number;
            status: string;
        }[];
    }[];
};

export type ReturnRequestCustomerActions = {
    createAction: typeof createReturnRequest;
    cancelAction: typeof cancelReturnRequest;
    trackingAction: typeof setReturnTrackingNumber;
};

export type ReturnRequestSellerActions = {
    approveAction: typeof approveReturnRequest;
    rejectAction: typeof rejectReturnRequest;
    receiveAction: typeof receiveReturnRequest;
    resolveAction: typeof resolveReturnRequest;
};

/** 表示用の状態名（顧客と seller で共通） */
export const RETURN_STATUS_LABELS: Record<ReturnRequestStatus, string> = {
    REQUESTED: "Requested",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    RECEIVED: "Received",
    RESOLVED: "Resolved",
    CANCELED: "Canceled",
};

/** 表示用の理由（並び順は申請フォームの選択肢の順） */
export const RETURN_REASON_LABELS: Record<ReturnReasonCode, string> = {
    SIZE_FIT: "Size or fit",
    DAMAGED: "Arrived damaged",
    DEFECTIVE: "Defective",
    WRONG_ITEM: "Wrong item",
    NOT_AS_DESCRIBED: "Not as described",
    CHANGED_MIND: "Changed my mind",
    OTHER: "Other",
};

/** 有効な RMA（申請できる残り数量から引く）でない状態 */
const INACTIVE_STATUSES: readonly ReturnRequestStatus[] = [
    "REJECTED",
    "CANCELED",
];

const toIso = (value: Date | null): string | null =>
    value ? value.toISOString() : null;

/**
 * RMA の行をクライアントへ渡せる値にする。返金額の目安は Decimal のまま積み上げ、
 * 境界で number にする（tech.md の金額規約）。
 */
export function serializeReturnRequests(
    rows: ReturnRequestRow[]
): ReturnRequestView[] {
    return rows.map((row) => ({
        id: row.id,
        orderGroupId: row.orderGroupId,
        orderId: row.orderGroup?.orderId ?? null,
        status: row.status,
        resolution: row.resolution,
        customerNote: row.customerNote,
        sellerNote: row.sellerNote,
        returnTrackingNumber: row.returnTrackingNumber,
        refundAmount: row.refundAmount ? toNumberSafe(row.refundAmount) : null,
        estimatedRefund: row.items
            .reduce(
                (sum, item) => sum.add(item.orderItem.price.mul(item.quantity)),
                new Prisma.Decimal(0)
            )
            .toNumber(),
        createdAt: row.createdAt.toISOString(),
        approvedAt: toIso(row.approvedAt),
        rejectedAt: toIso(row.rejectedAt),
        receivedAt: toIso(row.receivedAt),
        resolvedAt: toIso(row.resolvedAt),
        canceledAt: toIso(row.canceledAt),
        items: row.items.map((item) => ({
            id: item.id,
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            reasonCode: item.reasonCode,
            condition: item.condition,
            restockedQuantity: item.restockedQuantity,
            name: item.orderItem.name,
            image: item.orderItem.image,
            size: item.orderItem.size,
            price: toNumberSafe(item.orderItem.price),
        })),
    }));
}

/**
 * 店舗グループごとに、申請できる item（適格かつ残り数量 > 0）・期限・既存の RMA を返す。
 * 残り数量 = 購入数 − 有効な RMA（REJECTED / CANCELED 以外）の数量。最終的な判定は
 * サーバーの createReturnRequest がロックの下で行う（ここは表示用）。
 */
export function buildGroupReturnOptions(
    order: ReturnableOrder,
    requests: ReturnRequestView[],
    now: Date = new Date()
): Record<string, GroupReturnOptions> {
    const requested = new Map<string, number>();
    for (const request of requests) {
        if (INACTIVE_STATUSES.includes(request.status)) continue;
        for (const item of request.items) {
            requested.set(
                item.orderItemId,
                (requested.get(item.orderItemId) ?? 0) + item.quantity
            );
        }
    }

    const options: Record<string, GroupReturnOptions> = {};
    for (const group of order.groups) {
        const policy = {
            orderCreatedAt: order.createdAt,
            shippingDeliveryMax: group.shippingDeliveryMax,
            acceptsReturns: group.store.acceptsReturns,
            returnWindowDays: resolveReturnWindowDays(group.store),
        };
        const items = group.items.flatMap((item) => {
            const maxQuantity = item.quantity - (requested.get(item.id) ?? 0);
            const eligible =
                maxQuantity > 0 &&
                isReturnEligible({ ...policy, itemStatus: item.status }, now);
            return eligible
                ? [
                      {
                          id: item.id,
                          name: item.name,
                          image: item.image,
                          size: item.size,
                          maxQuantity,
                      },
                  ]
                : [];
        });
        options[group.id] = {
            groupId: group.id,
            deadline: group.store.acceptsReturns
                ? getReturnDeadline(policy).toISOString()
                : null,
            items,
            requests: requests.filter(
                (request) => request.orderGroupId === group.id
            ),
        };
    }
    return options;
}
