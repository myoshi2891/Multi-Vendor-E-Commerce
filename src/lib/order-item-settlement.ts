import { Prisma, ReturnRequestStatus } from "@prisma/client";
import type { db } from "@/lib/db";
import { ProductStatus } from "@/lib/types";

/**
 * OrderItem の精算（終端への遷移と在庫の復元）の共通処理（plan 087 / 088）。
 *
 * `src/queries/order.ts` と `src/queries/returns.ts` の両方から使う。`"use server"` の
 * ファイルに置いて export すると、在庫を戻す関数がクライアントから呼べる Server Action に
 * なってしまうため、`"use server"` を付けないこのモジュールに置く。
 * （決済の確定判定は別モジュール `order-settlement.ts` が受け持つ）
 */

/**
 * db.$transaction のコールバックが受け取る tx の型（Accelerate 拡張済みクライアント）。
 * 素の Prisma.TransactionClient とは非互換のため、$transaction から導出する。
 */
export type SettlementTx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * 減算済み在庫を復元する（placeOrder の decrement の対）。
 * 各 item の quantity を対応する Size.quantity に increment で戻す。quantity が 0 の行は飛ばす。
 * 注文側からは直接呼ばず、遷移した item だけを渡す settleOrderItems 経由で呼ぶこと（二重復元を防ぐ）。
 * 返品の受け取り（T6）は、遷移元を固定した RMA の更新が成功したときだけ数量を指定して呼ぶ。
 *
 * Size が作り直し・削除で消えている場合（updateProduct の全置換・design F-3）は戻す先が無いので、
 * 警告を残して続行する。update だと P2025 で取り消しそのものが失敗するため updateMany を使う。
 */
export const restockOrderItems = async (
    tx: SettlementTx,
    items: { sizeId: string; quantity: number }[]
): Promise<void> => {
    for (const item of items) {
        if (item.quantity <= 0) continue;
        const result = await tx.size.updateMany({
            where: { id: item.sizeId },
            data: { quantity: { increment: item.quantity } },
        });
        if (result.count === 0) {
            console.warn(
                "[Order:restockOrderItems] Size not found, skip restock",
                {
                    sizeId: item.sizeId,
                }
            );
        }
    }
};

/**
 * 在庫復元の印になる OrderItem の終端 status（plan 087・design §3）。
 * 終端は吸収状態で、終端 → 非終端の遷移は拒否する（I-2）。
 */
export const RESTOCK_TERMINAL_ITEM_STATUSES = [
    ProductStatus.Canceled,
    ProductStatus.Refunded,
    ProductStatus.Returned,
] as const;

export type RestockTerminalItemStatus =
    (typeof RESTOCK_TERMINAL_ITEM_STATUSES)[number];

export const isRestockTerminalItem = (
    status: string
): status is RestockTerminalItemStatus =>
    (RESTOCK_TERMINAL_ITEM_STATUSES as readonly string[]).includes(status);

/** OrderItem が「まだ終端でない」ことを表す条件 */
export const NOT_SETTLED_ITEM: Prisma.OrderItemWhereInput = {
    status: { notIn: [...RESTOCK_TERMINAL_ITEM_STATUSES] },
};

/**
 * 「返品済み」として数える RMA の状態（returns-rma design §4.3）。品物が店舗に届いた後の状態で、
 * RESELLABLE（受け取りで戻し済み）と DAMAGED（廃棄・戻してはいけない）の両方を含む。
 */
export const RETURNED_RMA_STATUSES = [
    ReturnRequestStatus.RECEIVED,
    ReturnRequestStatus.RESOLVED,
] as const;

/**
 * item ごとの返品済み数量（RECEIVED / RESOLVED の RMA 明細の数量の合計）を引く。
 * 呼び出し側が対象の OrderItem 行をロックしてから呼ぶこと（受け取りと直列にするため）。
 */
export const getReturnedQuantities = async (
    tx: SettlementTx,
    orderItemIds: string[]
): Promise<Map<string, number>> => {
    if (orderItemIds.length === 0) return new Map();
    const rows = await tx.returnRequestItem.groupBy({
        by: ["orderItemId"],
        where: {
            orderItemId: { in: orderItemIds },
            returnRequest: { status: { in: [...RETURNED_RMA_STATUSES] } },
        },
        _sum: { quantity: true },
    });
    return new Map(
        rows.map((row) => [row.orderItemId, row._sum.quantity ?? 0])
    );
};

/**
 * 対象 item のうち「まだ終端でないもの」だけを終端へ遷移させ、遷移した行の在庫だけを戻す
 * （design §2）。どの経路（order / group / item / 返品の解決）もこの 1 か所を通すことで、
 * 経路をまたいでも、並行しても、在庫はちょうど 1 回だけ戻る。並行時は UPDATE が行ロック後に
 * WHERE を評価し直すため、先に終端にされた行は戻り値に出てこない。
 *
 * 戻す量は `quantity − 返品済み数量`（returns-rma design §4.3 の差し引き方式）。返品の受け取りで
 * 戻した分（RESELLABLE）と、廃棄した分（DAMAGED）を二重に戻さないため。合計は UPDATE で
 * 行ロックを取った後に読むので、受け取り（T6）と同じ行ロックで直列になる。
 *
 * @param where 対象の絞り込み（{ id } / { orderGroupId } / { orderGroup: { orderId } }）
 * @param options.restock false は「品物を回収しない返金」など在庫を戻さない精算
 * @returns 実際に遷移した item（quantity は購入数のまま）
 */
export const settleOrderItems = async (
    tx: SettlementTx,
    where: Prisma.OrderItemWhereInput,
    status: RestockTerminalItemStatus,
    options: { restock: boolean } = { restock: true }
): Promise<{ id: string; sizeId: string; quantity: number }[]> => {
    const settled = await tx.orderItem.updateManyAndReturn({
        where: { AND: [where, NOT_SETTLED_ITEM] },
        data: { status },
        select: { id: true, sizeId: true, quantity: true },
    });
    if (!options.restock || settled.length === 0) return settled;

    const returned = await getReturnedQuantities(
        tx,
        settled.map((item) => item.id)
    );
    await restockOrderItems(
        tx,
        settled.map((item) => ({
            sizeId: item.sizeId,
            quantity: Math.max(0, item.quantity - (returned.get(item.id) ?? 0)),
        }))
    );
    return settled;
};
