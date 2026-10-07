import type { OrderStatus } from "@/lib/types";
import type { NotificationType } from "./mapping";
import { recordNotifications } from "./record";
import type { NotificationTx } from "./types";

/** 顧客へ通知する OrderGroup の遷移先（design §1。明細単位では通知しない） */
const NOTIFIABLE_GROUP_STATUS: Partial<Record<string, NotificationType>> = {
    Shipped: "order.group.shipped",
    Delivered: "order.group.delivered",
};

/**
 * 店舗単位の発送状態の遷移を通知として記録する。**主処理と同じ tx の中で呼ぶこと。**
 *
 * - 遷移先が通知対象でない、または同じ状態への再設定なら何もしない
 * - 遷移の判定は呼び出し元が tx の外で読んだ更新前の状態で行う。並行する更新で
 *   両方が「遷移した」と判定しても、dedupeKey の一意制約で行は 1 つに収まる
 * - 記録の失敗は catch しない（tx ごとロールバックさせる・design §4.5）
 *
 * @returns commit 後に送信する配信行の ID
 */
export const recordOrderGroupStatusNotification = async (
    tx: NotificationTx,
    input: {
        groupId: string;
        previousStatus: OrderStatus | string | undefined;
        nextStatus: OrderStatus;
    }
): Promise<string[]> => {
    const type = NOTIFIABLE_GROUP_STATUS[input.nextStatus];
    if (!type || input.previousStatus === input.nextStatus) return [];

    const group = await tx.orderGroup.findUnique({
        where: { id: input.groupId },
        select: {
            orderId: true,
            order: { select: { userId: true } },
            store: { select: { name: true } },
        },
    });
    if (!group) {
        throw new Error(
            "[Notifications:recordOrderGroupStatusNotification] order group not found"
        );
    }

    const { deliveryIds } = await recordNotifications(tx, [
        {
            type,
            recipientUserId: group.order.userId,
            source: { type: "OrderGroup", id: input.groupId },
            transition: input.nextStatus,
            params: { storeName: group.store.name, orderId: group.orderId },
            linkUrl: `/order/${group.orderId}`,
        },
    ]);
    return deliveryIds;
};
