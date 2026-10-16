import type { NotificationType } from "./mapping";
import { recordNotifications } from "./record";
import type { NotificationTx } from "./types";

/** RMA の遷移先と、それぞれで送る通知（returns-rma design §7.2） */
const RMA_NOTIFICATION: Record<
    | "REQUESTED"
    | "APPROVED"
    | "REJECTED"
    | "RECEIVED"
    | "RESOLVED"
    | "CANCELED",
    NotificationType
> = {
    REQUESTED: "rma.requested",
    APPROVED: "rma.approved",
    REJECTED: "rma.rejected",
    RECEIVED: "rma.received",
    RESOLVED: "rma.resolved",
    CANCELED: "rma.canceled",
};

export type RmaNotifiableStatus = keyof typeof RMA_NOTIFICATION;

/** 通知の受信者。seller は店舗の所有者、customer は申請者 */
export type RmaRecipient = "seller" | "customer";

/**
 * RMA の遷移を通知として記録する。**遷移と同じ tx の中で、`count === 1` のときだけ呼ぶこと。**
 *
 * - dedupeKey は `rma.<type>:ReturnRequest:<rmaId>:<toStatus>:<recipient>`（design §2.3 の末尾）。
 *   同じ遷移の再処理では行が増えない
 * - 記録の失敗は catch しない（遷移ごとロールバックさせる・notification design §4.5）
 *
 * @returns commit 後に送信する配信行の ID
 */
export const recordReturnRequestNotification = async (
    tx: NotificationTx,
    input: {
        returnRequestId: string;
        status: RmaNotifiableStatus;
        recipients: readonly RmaRecipient[];
    }
): Promise<string[]> => {
    const rma = await tx.returnRequest.findUnique({
        where: { id: input.returnRequestId },
        select: {
            userId: true,
            orderGroup: { select: { orderId: true } },
            store: { select: { name: true, url: true, userId: true } },
        },
    });
    if (!rma) {
        throw new Error(
            "[Notifications:recordReturnRequestNotification] return request not found"
        );
    }

    const type = RMA_NOTIFICATION[input.status];
    const params = {
        storeName: rma.store.name,
        orderId: rma.orderGroup.orderId,
    };
    const { deliveryIds } = await recordNotifications(
        tx,
        input.recipients.map((recipient) => ({
            type,
            recipientUserId:
                recipient === "seller" ? rma.store.userId : rma.userId,
            source: { type: "ReturnRequest", id: input.returnRequestId },
            transition: input.status,
            params,
            linkUrl:
                recipient === "seller"
                    ? (`/dashboard/seller/stores/${rma.store.url}/returns` as const)
                    : (`/order/${rma.orderGroup.orderId}` as const),
        }))
    );
    return deliveryIds;
};
