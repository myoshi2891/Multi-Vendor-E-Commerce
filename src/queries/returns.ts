"use server";

import { createHash } from "node:crypto";
import {
    Prisma,
    ReturnItemCondition,
    ReturnRequestStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import {
    requireAdmin,
    requireStoreOwner,
    requireUser,
} from "@/lib/auth-guards";
import { ProductStatus } from "@/lib/types";
import {
    CreateReturnRequestSchema,
    ReceiveReturnRequestSchema,
    RejectReturnRequestSchema,
    ReturnRequestIdSchema,
    ReturnRequestStatusFilterSchema,
    SetReturnTrackingNumberSchema,
    type CreateReturnRequestInput,
    type ReceiveReturnRequestItemInput,
} from "@/lib/schemas";
import {
    isReturnEligible,
    resolveReturnWindowDays,
} from "@/lib/returns-policy";
import {
    getReturnedQuantities,
    isRestockTerminalItem,
    restockOrderItems,
    settleOrderItems,
    type SettlementTx,
} from "@/lib/order-item-settlement";
import {
    recordReturnRequestNotification,
    type RmaRecipient,
} from "@/lib/notifications/rma-events";
import { scheduleDispatch } from "@/lib/notifications/schedule";

/**
 * 返品 RMA（店舗単位の返品申請）の Server Action 群（plan 088）。
 * 設計の正本: docs/design/returns-rma/design.md（遷移表は §4.1）。
 *
 * - 状態は下の遷移 action を通してしか変えない。任意の状態を受け取る更新 action は作らない（§4.2）
 * - 遷移はすべて「遷移元を固定した updateMany → count === 1 のときだけ副作用」の形にする
 * - 認可ガードは try/catch の外に置く（tech.md「エラーハンドリング」）
 * - 返金 API は呼ばない（DIRECTION-01）。T7 は商品代金の目安（refundAmount）を確定するだけ
 */

export type ReturnRequestSummary = {
    id: string;
    status: ReturnRequestStatus;
};

/** 有効な RMA（数量の上限 R-1 の計算に含める）でない状態 */
const INACTIVE_RMA_STATUSES: ReturnRequestStatus[] = [
    ReturnRequestStatus.REJECTED,
    ReturnRequestStatus.CANCELED,
];

/** tx の中で見つけた「業務上の拒否」。ロールバックさせ、catch の外で同じ文言を返す */
class ReturnRequestRejection extends Error {}

/**
 * commit 後に通知の送信を予約する（tx の外）。送信の失敗は RMA の遷移を巻き戻さない
 * —— 送れなかった配信は sweeper が拾い直す（order.ts の dispatchAfterCommit と同じ扱い）。
 */
const dispatchAfterCommit = (deliveryIds: string[], fn: string): void => {
    try {
        scheduleDispatch(deliveryIds);
    } catch (error: unknown) {
        logError(
            `[Returns:${fn}] Failed to schedule notification dispatch`,
            error
        );
    }
};

/**
 * 申請内容の正規化ハッシュ（design §2.3）。明細は orderItemId の昇順にそろえる。
 * customerNote は含めない（誤字を直して再送しても、同じ申請として扱うため）。
 */
const buildRequestHash = (input: CreateReturnRequestInput): string => {
    const items = [...input.items]
        .sort((a, b) => a.orderItemId.localeCompare(b.orderItemId))
        .map((item) => [item.orderItemId, item.quantity, item.reasonCode]);
    return createHash("sha256")
        .update(
            JSON.stringify({
                orderGroupId: input.orderGroupId,
                resolution: input.resolution,
                items,
            })
        )
        .digest("hex");
};

const isUniqueViolation = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002";

type LockedOrderItemRow = {
    id: string;
    quantity: number;
    status: string;
    storeId: string;
    shippingDeliveryMax: number;
    orderCreatedAt: Date;
    acceptsReturns: boolean;
    returnWindowDays: number | null;
};

type CreateOutcome =
    | {
          kind: "created";
          id: string;
          status: ReturnRequestStatus;
          deliveryIds: string[];
      }
    | {
          kind: "existing";
          id: string;
          status: ReturnRequestStatus;
          requestHash: string;
      }
    | { kind: "not_found" }
    | { kind: "ineligible" }
    | { kind: "over_quantity" };

/** 同じ主体・同じキーで作られた既存の RMA を引く（冪等性の再送判定用） */
const findByIdempotencyKey = (
    client: SettlementTx | typeof db,
    userId: string,
    idempotencyKey: string
) =>
    client.returnRequest.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        select: { id: true, status: true, requestHash: true },
    });

/**
 * @function createReturnRequest
 * @description 顧客が自分の注文の店舗グループに対して返品を申請する（T1）。
 *              対象の OrderItem 行を FOR UPDATE でロックしてから有効な RMA の数量を数え、
 *              上限（R-1）を並行時にも守る。同じキー・同じ内容の再送は既存の RMA を返す（R-2）。
 * @access USER（注文の所有者）
 * @returns 作成した（または既存の）RMA の ID と状態
 */
export const createReturnRequest = async (
    input: CreateReturnRequestInput
): Promise<ReturnRequestSummary> => {
    const user = await requireUser();

    const parsed = CreateReturnRequestSchema.safeParse(input);
    if (!parsed.success) throw new Error("Invalid return request.");
    const data = parsed.data;
    const requestHash = buildRequestHash(data);
    // ロックの順序を固定してデッドロックを避ける（SQL 側の ORDER BY と同じ順）
    const itemIds = data.items.map((item) => item.orderItemId).sort();

    let outcome: CreateOutcome;
    try {
        outcome = await db.$transaction(async (tx): Promise<CreateOutcome> => {
            // 再送は R-1 の判定より先に見る（全数の申請の再送が「数量超過」で弾かれないように）
            const existing = await findByIdempotencyKey(
                tx,
                user.id,
                data.idempotencyKey
            );
            if (existing) return { kind: "existing", ...existing };

            // 所有の確認とロックを 1 文で行う。他人の item や別の店舗グループの item は 0 行になる
            const locked = await tx.$queryRaw<LockedOrderItemRow[]>`
                SELECT oi."id", oi."quantity", oi."status"::text AS "status",
                       og."storeId", og."shippingDeliveryMax",
                       o."createdAt" AS "orderCreatedAt",
                       s."acceptsReturns", s."returnWindowDays"
                FROM "OrderItem" oi
                JOIN "OrderGroup" og ON og."id" = oi."orderGroupId"
                JOIN "Order" o ON o."id" = og."orderId"
                JOIN "Store" s ON s."id" = og."storeId"
                WHERE oi."id" IN (${Prisma.join(itemIds)})
                  AND og."id" = ${data.orderGroupId}
                  AND o."userId" = ${user.id}
                ORDER BY oi."id"
                FOR UPDATE OF oi
            `;
            // IDOR: 存在しないのと同じ応答にする
            if (locked.length !== itemIds.length) return { kind: "not_found" };

            const now = new Date();
            const eligible = locked.every((row) =>
                isReturnEligible(
                    {
                        itemStatus: row.status,
                        orderCreatedAt: row.orderCreatedAt,
                        shippingDeliveryMax: row.shippingDeliveryMax,
                        acceptsReturns: row.acceptsReturns,
                        returnWindowDays: resolveReturnWindowDays(row),
                    },
                    now
                )
            );
            if (!eligible) return { kind: "ineligible" };

            // ロック中なので、同じ item へのほかの申請はここで待つ
            const active = await tx.returnRequestItem.groupBy({
                by: ["orderItemId"],
                where: {
                    orderItemId: { in: itemIds },
                    returnRequest: { status: { notIn: INACTIVE_RMA_STATUSES } },
                },
                _sum: { quantity: true },
            });
            const activeById = new Map(
                active.map((row) => [row.orderItemId, row._sum.quantity ?? 0])
            );
            const purchasedById = new Map(
                locked.map((row) => [row.id, row.quantity])
            );
            const exceeds = data.items.some(
                (item) =>
                    (activeById.get(item.orderItemId) ?? 0) + item.quantity >
                    (purchasedById.get(item.orderItemId) ?? 0)
            );
            if (exceeds) return { kind: "over_quantity" };

            const created = await tx.returnRequest.create({
                data: {
                    orderGroupId: data.orderGroupId,
                    // 入力からは受け取らず、ロックした行から写す
                    storeId: locked[0].storeId,
                    userId: user.id,
                    resolution: data.resolution,
                    idempotencyKey: data.idempotencyKey,
                    requestHash,
                    customerNote: data.customerNote || null,
                    items: {
                        create: data.items.map((item) => ({
                            orderItemId: item.orderItemId,
                            quantity: item.quantity,
                            reasonCode: item.reasonCode,
                        })),
                    },
                },
                select: { id: true, status: true },
            });
            const deliveryIds = await recordReturnRequestNotification(tx, {
                returnRequestId: created.id,
                status: ReturnRequestStatus.REQUESTED,
                recipients: ["seller"],
            });
            return { kind: "created", ...created, deliveryIds };
        });
    } catch (error: unknown) {
        // 同じキーの並行な再送が一意制約に当たった。tx は使えなくなっているので外で引き直す
        // （PostgreSQL では tx の中でエラーが起きると、その tx は以後のクエリを受け付けない）
        if (!isUniqueViolation(error)) {
            logError("[Returns:createReturnRequest] Create failed", error);
            throw new Error("Failed to create return request.");
        }
        let existing: Awaited<ReturnType<typeof findByIdempotencyKey>>;
        try {
            existing = await findByIdempotencyKey(
                db,
                user.id,
                data.idempotencyKey
            );
        } catch (lookupError: unknown) {
            logError(
                "[Returns:createReturnRequest] Idempotency lookup failed",
                lookupError
            );
            throw new Error("Failed to create return request.");
        }
        if (!existing) {
            logError(
                "[Returns:createReturnRequest] Unique violation without a matching request",
                error
            );
            throw new Error("Failed to create return request.");
        }
        outcome = { kind: "existing", ...existing };
    }

    switch (outcome.kind) {
        case "not_found":
            throw new Error("Order item not found");
        case "ineligible":
            throw new Error("Order item is not eligible for return.");
        case "over_quantity":
            throw new Error("Return quantity exceeds purchased quantity.");
        case "existing":
            if (outcome.requestHash !== requestHash) {
                throw new Error(
                    "Idempotency key was reused with a different request."
                );
            }
            return { id: outcome.id, status: outcome.status };
        case "created":
            dispatchAfterCommit(outcome.deliveryIds, "createReturnRequest");
            return { id: outcome.id, status: outcome.status };
    }
};

// ------------------------------------------------------------------
// 遷移（T2〜T8）の共通部分
// ------------------------------------------------------------------

type TransitionOutcome =
    | { kind: "ok"; status: ReturnRequestStatus; deliveryIds: string[] }
    | { kind: "already"; status: ReturnRequestStatus }
    | { kind: "not_found" }
    | { kind: "invalid_state" };

type TransitionSpec = {
    fn: string;
    failMessage: string;
    returnRequestId: string;
    /** 主体のスコープ（seller: storeId / 顧客: userId / admin: なし） */
    scope: Prisma.ReturnRequestWhereInput;
    from: ReturnRequestStatus[];
    to: ReturnRequestStatus;
    data?: Prisma.ReturnRequestUpdateManyMutationInput;
    recipients: readonly RmaRecipient[];
    /** 遷移が成立した（count === 1）ときだけ、同じ tx の中で実行する */
    sideEffects?: (tx: SettlementTx) => Promise<void>;
};

/**
 * 遷移元を固定した条件付き更新で 1 回だけ遷移させる。
 * count === 0 のときは理由を読み直す: スコープ外・不存在は not_found（存在を漏らさない）、
 * すでに遷移先にいれば already（副作用なしで成功扱い）、それ以外は invalid_state。
 */
const runTransition = async (
    spec: TransitionSpec
): Promise<ReturnRequestStatus> => {
    let outcome: TransitionOutcome;
    try {
        outcome = await db.$transaction(
            async (tx): Promise<TransitionOutcome> => {
                const where = { id: spec.returnRequestId, ...spec.scope };
                const updated = await tx.returnRequest.updateMany({
                    where: { ...where, status: { in: spec.from } },
                    data: { ...spec.data, status: spec.to },
                });
                if (updated.count === 0) {
                    const current = await tx.returnRequest.findFirst({
                        where,
                        select: { status: true },
                    });
                    if (!current) return { kind: "not_found" };
                    if (current.status === spec.to) {
                        return { kind: "already", status: current.status };
                    }
                    return { kind: "invalid_state" };
                }
                if (spec.sideEffects) await spec.sideEffects(tx);
                const deliveryIds = await recordReturnRequestNotification(tx, {
                    returnRequestId: spec.returnRequestId,
                    status: spec.to,
                    recipients: spec.recipients,
                });
                return { kind: "ok", status: spec.to, deliveryIds };
            }
        );
    } catch (error: unknown) {
        if (error instanceof ReturnRequestRejection) {
            throw new Error(error.message);
        }
        logError(`[Returns:${spec.fn}] Transition failed`, error);
        throw new Error(spec.failMessage);
    }

    switch (outcome.kind) {
        case "not_found":
            throw new Error("Return request not found.");
        case "invalid_state":
            throw new Error(
                "Return request is not in a valid state for this action."
            );
        case "already":
            return outcome.status;
        case "ok":
            dispatchAfterCommit(outcome.deliveryIds, spec.fn);
            return outcome.status;
    }
};

const parseReturnRequestId = (returnRequestId: string): string => {
    const parsed = ReturnRequestIdSchema.safeParse(returnRequestId);
    if (!parsed.success) throw new Error("Return request not found.");
    return parsed.data;
};

/** OrderItem 行を id 順にロックし、状態と在庫の戻し先を読む（T6 / T7） */
const lockOrderItems = (tx: SettlementTx, orderItemIds: string[]) =>
    tx.$queryRaw<{ id: string; status: string; sizeId: string }[]>`
        SELECT "id", "status"::text AS "status", "sizeId"
        FROM "OrderItem"
        WHERE "id" IN (${Prisma.join([...orderItemIds].sort())})
        ORDER BY "id"
        FOR UPDATE
    `;

/**
 * T6 の副作用: 明細ごとに状態を記録し、RESELLABLE の数量だけ在庫を戻す（design §4.3）。
 * 対象の OrderItem 行をロックしてから判定するので、取り消し・返金（settleOrderItems）と直列になる。
 * その OrderItem がすでに終端なら、取り消し・返金のほうで全数が戻っているので戻さない。
 */
const receiveSideEffects =
    (returnRequestId: string, conditions: ReceiveReturnRequestItemInput[]) =>
    async (tx: SettlementTx): Promise<void> => {
        const items = await tx.returnRequestItem.findMany({
            where: { returnRequestId },
            select: { id: true, orderItemId: true, quantity: true },
        });
        const conditionById = new Map(
            conditions.map((c) => [c.returnRequestItemId, c.condition])
        );
        const complete =
            conditionById.size === items.length &&
            items.every((item) => conditionById.has(item.id));
        if (!complete) {
            throw new ReturnRequestRejection(
                "Condition is required for every returned item."
            );
        }

        const locked = await lockOrderItems(
            tx,
            items.map((item) => item.orderItemId)
        );
        const lockedById = new Map(locked.map((row) => [row.id, row]));

        for (const item of items) {
            const condition = conditionById.get(item.id);
            const orderItem = lockedById.get(item.orderItemId);
            const resellable = condition === ReturnItemCondition.RESELLABLE;
            const settled =
                !orderItem || isRestockTerminalItem(orderItem.status);
            if (resellable && settled) {
                console.warn(
                    "[Returns:receiveReturnRequest] Order item already settled, skip restock",
                    { orderItemId: item.orderItemId }
                );
            }
            const restockedQuantity =
                resellable && !settled ? item.quantity : 0;
            await tx.returnRequestItem.update({
                where: { id: item.id },
                data: { condition, restockedQuantity },
            });
            if (orderItem && restockedQuantity > 0) {
                await restockOrderItems(tx, [
                    { sizeId: orderItem.sizeId, quantity: restockedQuantity },
                ]);
            }
        }
    };

/**
 * T7 の副作用: 返金額（商品代金の目安）を Decimal で確定し、返品が全数になった OrderItem を
 * `Returned` の終端にする。settleOrderItems は返品済み数量を差し引くので、戻す量は 0 になる。
 */
const resolveSideEffects =
    (returnRequestId: string) =>
    async (tx: SettlementTx): Promise<void> => {
        const items = await tx.returnRequestItem.findMany({
            where: { returnRequestId },
            select: {
                orderItemId: true,
                quantity: true,
                orderItem: { select: { price: true, quantity: true } },
            },
        });
        // 金額は Prisma.Decimal のまま積み上げる（tech.md の金額規約）
        const refundAmount = items.reduce(
            (sum, item) => sum.add(item.orderItem.price.mul(item.quantity)),
            new Prisma.Decimal(0)
        );
        await tx.returnRequest.update({
            where: { id: returnRequestId },
            data: { refundAmount },
        });

        const orderItemIds = items.map((item) => item.orderItemId);
        await lockOrderItems(tx, orderItemIds);
        const returned = await getReturnedQuantities(tx, orderItemIds);
        const fullyReturned = items
            .filter(
                (item) =>
                    (returned.get(item.orderItemId) ?? 0) >=
                    item.orderItem.quantity
            )
            .map((item) => item.orderItemId);
        if (fullyReturned.length > 0) {
            await settleOrderItems(
                tx,
                { id: { in: fullyReturned } },
                ProductStatus.Returned
            );
        }
    };

// ------------------------------------------------------------------
// seller（店舗の所有者）
// ------------------------------------------------------------------

/**
 * @function approveReturnRequest
 * @description REQUESTED の RMA を承認する（T2）。顧客に rma.approved を送る。
 * @access SELLER（storeUrl の所有者）
 */
export const approveReturnRequest = async (
    storeUrl: string,
    returnRequestId: string
): Promise<ReturnRequestStatus> => {
    const { store } = await requireStoreOwner(storeUrl);
    return runTransition({
        fn: "approveReturnRequest",
        failMessage: "Failed to approve return request.",
        returnRequestId: parseReturnRequestId(returnRequestId),
        scope: { storeId: store.id },
        from: [ReturnRequestStatus.REQUESTED],
        to: ReturnRequestStatus.APPROVED,
        data: { approvedAt: new Date() },
        recipients: ["customer"],
    });
};

/**
 * @function rejectReturnRequest
 * @description REQUESTED の RMA を却下する（T3）。却下の理由（sellerNote）は必須。
 * @access SELLER（storeUrl の所有者）
 */
export const rejectReturnRequest = async (
    storeUrl: string,
    returnRequestId: string,
    sellerNote: string
): Promise<ReturnRequestStatus> => {
    const { store } = await requireStoreOwner(storeUrl);
    const parsed = RejectReturnRequestSchema.safeParse({
        returnRequestId,
        sellerNote,
    });
    if (!parsed.success) throw new Error("Invalid reject request.");
    return runTransition({
        fn: "rejectReturnRequest",
        failMessage: "Failed to reject return request.",
        returnRequestId: parsed.data.returnRequestId,
        scope: { storeId: store.id },
        from: [ReturnRequestStatus.REQUESTED],
        to: ReturnRequestStatus.REJECTED,
        data: { rejectedAt: new Date(), sellerNote: parsed.data.sellerNote },
        recipients: ["customer"],
    });
};

/**
 * @function receiveReturnRequest
 * @description APPROVED の RMA の品物を受け取る（T6）。明細ごとの状態（RESELLABLE / DAMAGED）を
 *              記録し、RESELLABLE の数量だけ在庫を戻す。
 * @access SELLER（storeUrl の所有者）
 */
export const receiveReturnRequest = async (
    storeUrl: string,
    returnRequestId: string,
    items: ReceiveReturnRequestItemInput[]
): Promise<ReturnRequestStatus> => {
    const { store } = await requireStoreOwner(storeUrl);
    const parsed = ReceiveReturnRequestSchema.safeParse({
        returnRequestId,
        items,
    });
    if (!parsed.success) throw new Error("Invalid receive request.");
    return runTransition({
        fn: "receiveReturnRequest",
        failMessage: "Failed to receive return request.",
        returnRequestId: parsed.data.returnRequestId,
        scope: { storeId: store.id },
        from: [ReturnRequestStatus.APPROVED],
        to: ReturnRequestStatus.RECEIVED,
        data: { receivedAt: new Date() },
        recipients: ["customer"],
        sideEffects: receiveSideEffects(
            parsed.data.returnRequestId,
            parsed.data.items
        ),
    });
};

/**
 * @function resolveReturnRequest
 * @description RECEIVED の RMA を解決する（T7）。返金額（商品代金の目安）を確定するだけで、
 *              返金 API は呼ばない。全数が返品された OrderItem は Returned にする。
 * @access SELLER（storeUrl の所有者）
 */
export const resolveReturnRequest = async (
    storeUrl: string,
    returnRequestId: string
): Promise<ReturnRequestStatus> => {
    const { store } = await requireStoreOwner(storeUrl);
    const id = parseReturnRequestId(returnRequestId);
    return runTransition({
        fn: "resolveReturnRequest",
        failMessage: "Failed to resolve return request.",
        returnRequestId: id,
        scope: { storeId: store.id },
        from: [ReturnRequestStatus.RECEIVED],
        to: ReturnRequestStatus.RESOLVED,
        data: { resolvedAt: new Date() },
        recipients: ["customer"],
        sideEffects: resolveSideEffects(id),
    });
};

// ------------------------------------------------------------------
// admin（全店舗横断）
// ------------------------------------------------------------------

/** @access ADMIN — approveReturnRequest の全店舗版（T2） */
export const approveReturnRequestAsAdmin = async (
    returnRequestId: string
): Promise<ReturnRequestStatus> => {
    await requireAdmin();
    return runTransition({
        fn: "approveReturnRequestAsAdmin",
        failMessage: "Failed to approve return request.",
        returnRequestId: parseReturnRequestId(returnRequestId),
        scope: {},
        from: [ReturnRequestStatus.REQUESTED],
        to: ReturnRequestStatus.APPROVED,
        data: { approvedAt: new Date() },
        recipients: ["customer"],
    });
};

/** @access ADMIN — rejectReturnRequest の全店舗版（T3） */
export const rejectReturnRequestAsAdmin = async (
    returnRequestId: string,
    sellerNote: string
): Promise<ReturnRequestStatus> => {
    await requireAdmin();
    const parsed = RejectReturnRequestSchema.safeParse({
        returnRequestId,
        sellerNote,
    });
    if (!parsed.success) throw new Error("Invalid reject request.");
    return runTransition({
        fn: "rejectReturnRequestAsAdmin",
        failMessage: "Failed to reject return request.",
        returnRequestId: parsed.data.returnRequestId,
        scope: {},
        from: [ReturnRequestStatus.REQUESTED],
        to: ReturnRequestStatus.REJECTED,
        data: { rejectedAt: new Date(), sellerNote: parsed.data.sellerNote },
        recipients: ["customer"],
    });
};

/** @access ADMIN — receiveReturnRequest の全店舗版（T6） */
export const receiveReturnRequestAsAdmin = async (
    returnRequestId: string,
    items: ReceiveReturnRequestItemInput[]
): Promise<ReturnRequestStatus> => {
    await requireAdmin();
    const parsed = ReceiveReturnRequestSchema.safeParse({
        returnRequestId,
        items,
    });
    if (!parsed.success) throw new Error("Invalid receive request.");
    return runTransition({
        fn: "receiveReturnRequestAsAdmin",
        failMessage: "Failed to receive return request.",
        returnRequestId: parsed.data.returnRequestId,
        scope: {},
        from: [ReturnRequestStatus.APPROVED],
        to: ReturnRequestStatus.RECEIVED,
        data: { receivedAt: new Date() },
        recipients: ["customer"],
        sideEffects: receiveSideEffects(
            parsed.data.returnRequestId,
            parsed.data.items
        ),
    });
};

/** @access ADMIN — resolveReturnRequest の全店舗版（T7） */
export const resolveReturnRequestAsAdmin = async (
    returnRequestId: string
): Promise<ReturnRequestStatus> => {
    await requireAdmin();
    const id = parseReturnRequestId(returnRequestId);
    return runTransition({
        fn: "resolveReturnRequestAsAdmin",
        failMessage: "Failed to resolve return request.",
        returnRequestId: id,
        scope: {},
        from: [ReturnRequestStatus.RECEIVED],
        to: ReturnRequestStatus.RESOLVED,
        data: { resolvedAt: new Date() },
        recipients: ["customer"],
        sideEffects: resolveSideEffects(id),
    });
};

/**
 * @function cancelReturnRequestAsAdmin
 * @description 運営による取り消し（T8）。REQUESTED / APPROVED のみ。顧客と seller の両方に通知する。
 * @access ADMIN
 */
export const cancelReturnRequestAsAdmin = async (
    returnRequestId: string
): Promise<ReturnRequestStatus> => {
    await requireAdmin();
    return runTransition({
        fn: "cancelReturnRequestAsAdmin",
        failMessage: "Failed to cancel return request.",
        returnRequestId: parseReturnRequestId(returnRequestId),
        scope: {},
        from: [ReturnRequestStatus.REQUESTED, ReturnRequestStatus.APPROVED],
        to: ReturnRequestStatus.CANCELED,
        data: { canceledAt: new Date() },
        recipients: ["customer", "seller"],
    });
};

// ------------------------------------------------------------------
// 顧客（申請者）
// ------------------------------------------------------------------

/**
 * @function cancelReturnRequest
 * @description 顧客が自分の RMA を取り下げる（T4）。REQUESTED / APPROVED のみ
 *              （RECEIVED 以降は品物が店舗にあるので取り下げられない）。
 * @access USER（申請者）
 */
export const cancelReturnRequest = async (
    returnRequestId: string
): Promise<ReturnRequestStatus> => {
    const user = await requireUser();
    return runTransition({
        fn: "cancelReturnRequest",
        failMessage: "Failed to cancel return request.",
        returnRequestId: parseReturnRequestId(returnRequestId),
        scope: { userId: user.id },
        from: [ReturnRequestStatus.REQUESTED, ReturnRequestStatus.APPROVED],
        to: ReturnRequestStatus.CANCELED,
        data: { canceledAt: new Date() },
        recipients: ["seller"],
    });
};

/**
 * @function setReturnTrackingNumber
 * @description 顧客が返送の追跡番号を入力する（T5）。状態は APPROVED のまま変えない。
 * @access USER（申請者）
 */
export const setReturnTrackingNumber = async (
    returnRequestId: string,
    trackingNumber: string
): Promise<ReturnRequestStatus> => {
    const user = await requireUser();
    const parsed = SetReturnTrackingNumberSchema.safeParse({
        returnRequestId,
        trackingNumber,
    });
    if (!parsed.success) throw new Error("Invalid tracking number.");

    const where = { id: parsed.data.returnRequestId, userId: user.id };
    let outcome: "ok" | "not_found" | "invalid_state";
    try {
        outcome = await db.$transaction(async (tx) => {
            const updated = await tx.returnRequest.updateMany({
                where: { ...where, status: ReturnRequestStatus.APPROVED },
                data: { returnTrackingNumber: parsed.data.trackingNumber },
            });
            if (updated.count === 1) return "ok";
            const current = await tx.returnRequest.findFirst({
                where,
                select: { id: true },
            });
            return current ? "invalid_state" : "not_found";
        });
    } catch (error: unknown) {
        logError("[Returns:setReturnTrackingNumber] Update failed", error);
        throw new Error("Failed to update tracking number.");
    }

    if (outcome === "not_found") throw new Error("Return request not found.");
    if (outcome === "invalid_state") {
        throw new Error(
            "Return request is not in a valid state for this action."
        );
    }
    return ReturnRequestStatus.APPROVED;
};

// ------------------------------------------------------------------
// 読み取り
// ------------------------------------------------------------------

const RETURN_REQUEST_SELECT = {
    id: true,
    orderGroupId: true,
    status: true,
    resolution: true,
    customerNote: true,
    sellerNote: true,
    returnTrackingNumber: true,
    refundAmount: true,
    approvedAt: true,
    rejectedAt: true,
    receivedAt: true,
    resolvedAt: true,
    canceledAt: true,
    createdAt: true,
    items: {
        select: {
            id: true,
            orderItemId: true,
            quantity: true,
            reasonCode: true,
            condition: true,
            restockedQuantity: true,
            orderItem: {
                select: { name: true, image: true, size: true, price: true },
            },
        },
    },
} satisfies Prisma.ReturnRequestSelect;

/**
 * @function getReturnRequestsForOrder
 * @description 顧客の注文に紐づく自分の RMA を新しい順に返す（注文詳細の状態表示用）。
 * @access USER（注文の所有者）
 */
export const getReturnRequestsForOrder = async (orderId: string) => {
    const user = await requireUser();
    try {
        return await db.returnRequest.findMany({
            where: { userId: user.id, orderGroup: { orderId } },
            select: RETURN_REQUEST_SELECT,
            orderBy: { createdAt: "desc" },
        });
    } catch (error: unknown) {
        logError("[Returns:getReturnRequestsForOrder] Query failed", error);
        throw new Error("Failed to get return requests.");
    }
};

/**
 * @function getStoreReturnRequests
 * @description 店舗の返品キュー。状態で絞り込める（seller ダッシュボード用）。
 * @access SELLER（storeUrl の所有者）
 */
export const getStoreReturnRequests = async (
    storeUrl: string,
    status?: ReturnRequestStatus
) => {
    const { store } = await requireStoreOwner(storeUrl);
    const parsedStatus = ReturnRequestStatusFilterSchema.safeParse(status);
    if (!parsedStatus.success) {
        throw new Error("Invalid return request status.");
    }
    try {
        return await db.returnRequest.findMany({
            where: {
                storeId: store.id,
                ...(parsedStatus.data ? { status: parsedStatus.data } : {}),
            },
            select: {
                ...RETURN_REQUEST_SELECT,
                orderGroup: { select: { orderId: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    } catch (error: unknown) {
        logError("[Returns:getStoreReturnRequests] Query failed", error);
        throw new Error("Failed to get return requests.");
    }
};
