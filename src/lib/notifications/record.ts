import { buildDedupeKey } from "./dedupe-key";
import { hasEmailChannel, isNotificationType } from "./mapping";
import type { NotificationEvent, NotificationTx } from "./types";

/**
 * 通知を記録する（原子的 Outbox・design §4.2）。**主処理と同じ tx の中で呼ぶこと。**
 *
 * - `Notification` を `skipDuplicates`（ON CONFLICT DO NOTHING）で作る。同じ dedupeKey の
 *   再処理では行が増えず、主処理も失敗しない
 * - email チャネルを持つ種別には `NotificationDelivery(PENDING)` を作る。重複でスキップ
 *   された通知には作らない（`createManyAndReturn` は実際に挿入した行だけを返す）
 * - 送信はしない。送信は commit 後に `dispatchPendingDeliveries` が行う
 * - 書き込みの失敗は catch しない。呼び出し元の tx ごとロールバックさせ、
 *   「主処理は成立したのに通知の記録が無い」状態を作らないため（design §4.5）
 *
 * 配列形式の `$transaction([...])` 向けの版は用意していない。配列形式では、重複で
 * スキップされた通知の ID を配信行の作成に渡せず、FK 違反で主処理ごと失敗するため。
 *
 * @returns 新しく作った配信行の ID（commit 後の送信対象）
 */
export const recordNotifications = async (
    tx: NotificationTx,
    events: readonly NotificationEvent[]
): Promise<{ deliveryIds: string[] }> => {
    if (events.length === 0) return { deliveryIds: [] };

    const created = await tx.notification.createManyAndReturn({
        data: events.map((event) => ({
            userId: event.recipientUserId,
            type: event.type,
            params: event.params,
            linkUrl: event.linkUrl,
            sourceType: event.source.type,
            sourceId: event.source.id,
            dedupeKey: buildDedupeKey(event),
        })),
        skipDuplicates: true,
        select: { id: true, type: true },
    });

    const emailTargets = created.filter(
        (n) => isNotificationType(n.type) && hasEmailChannel(n.type)
    );
    if (emailTargets.length === 0) return { deliveryIds: [] };

    const deliveries = await tx.notificationDelivery.createManyAndReturn({
        data: emailTargets.map((n) => ({
            notificationId: n.id,
            channel: "email",
        })),
        skipDuplicates: true,
        select: { id: true },
    });

    return { deliveryIds: deliveries.map((d) => d.id) };
};
