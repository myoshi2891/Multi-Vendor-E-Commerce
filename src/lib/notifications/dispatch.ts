import { DeliveryStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { getEmailProvider, type EmailProvider } from "./email-provider";
import { isNotificationType } from "./mapping";
import { toNotificationParams } from "./templates";

/** claim してから送信を終えるまでのリース（期限切れの行は別のワーカーが拾える） */
export const LEASE_MS = 2 * 60 * 1000;

/**
 * 最初の試行から再試行を続ける上限。Resend の冪等キーの保持（24 時間）より短くし、
 * 再送が常に保持期間内に収まるようにする（design §4.4）。
 */
export const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

/** 再試行の間隔（試行回数に応じて伸ばす。上限 1 時間） */
const backoffMs = (attempt: number): number =>
    Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempt - 1));

export type DispatchResult = {
    sent: number;
    retried: number;
    failed: number;
    skipped: number;
};

type DispatchOptions = {
    /** 指定すると、その ID だけを対象にする（commit 直後の after() から使う） */
    deliveryIds?: readonly string[];
    limit: number;
    provider?: EmailProvider;
    now?: () => Date;
};

/** claim できる行の条件: 待機中で backoff が明けている、またはリースが切れた送信中 */
const claimableWhere = (now: Date) => ({
    OR: [
        {
            status: DeliveryStatus.PENDING,
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
        },
        { status: DeliveryStatus.SENDING, leaseExpiresAt: { lt: now } },
    ],
});

const finish = (
    id: string,
    data: {
        status: DeliveryStatus;
        lastError?: string | null;
        leaseExpiresAt?: Date | null;
        sentAt?: Date;
        providerMessageId?: string;
    }
) => db.notificationDelivery.update({ where: { id }, data });

/**
 * 未送信のメール配信を送る（design §4.3 のリース方式）。**tx の外で呼ぶこと。**
 *
 * claim（SENDING + リース）→ 送信 → 結果の記録、の順に進む。「送信済み」を送信の前に
 * 書かないので、途中でプロセスが落ちても行は失われず、リース切れで拾い直される。
 * 1 件の失敗で残りを止めない。ログには配信 ID とエラー種別だけを出す（宛先は出さない）。
 */
export const dispatchPendingDeliveries = async (
    opts: DispatchOptions
): Promise<DispatchResult> => {
    const result: DispatchResult = {
        sent: 0,
        retried: 0,
        failed: 0,
        skipped: 0,
    };
    if (opts.deliveryIds && opts.deliveryIds.length === 0) return result;

    const provider = opts.provider ?? getEmailProvider();
    const now = (opts.now ?? (() => new Date()))();

    const candidates = await db.notificationDelivery.findMany({
        where: {
            ...(opts.deliveryIds ? { id: { in: [...opts.deliveryIds] } } : {}),
            channel: "email",
            ...claimableWhere(now),
        },
        select: {
            id: true,
            status: true,
            attemptCount: true,
            firstAttemptAt: true,
            notificationId: true,
        },
        orderBy: { createdAt: "asc" },
        take: opts.limit,
    });

    for (const row of candidates) {
        try {
            const firstAttemptAt = row.firstAttemptAt ?? now;

            // 条件付き更新で claim する。並行するワーカーのうち count === 1 になるのは 1 つだけ
            const claimed = await db.notificationDelivery.updateMany({
                where: { id: row.id, ...claimableWhere(now) },
                data: {
                    status: DeliveryStatus.SENDING,
                    attemptCount: { increment: 1 },
                    leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
                    firstAttemptAt,
                },
            });
            if (claimed.count === 0) {
                result.skipped += 1;
                continue;
            }

            if (now.getTime() - firstAttemptAt.getTime() > RETRY_WINDOW_MS) {
                await finish(row.id, {
                    status: DeliveryStatus.FAILED,
                    lastError: "retry_window_exceeded",
                    leaseExpiresAt: null,
                });
                result.failed += 1;
                continue;
            }

            // リース切れの SENDING は「送ったかどうか分からない」行。冪等キーに対応しない
            // プロバイダで送り直すと二重に届くので、送らずに FAILED にする
            if (
                row.status === DeliveryStatus.SENDING &&
                provider.idempotencyWindowMs === 0
            ) {
                await finish(row.id, {
                    status: DeliveryStatus.FAILED,
                    lastError: "unsafe_resend",
                    leaseExpiresAt: null,
                });
                result.failed += 1;
                continue;
            }

            const notification = await db.notification.findUnique({
                where: { id: row.notificationId },
                select: {
                    type: true,
                    params: true,
                    dedupeKey: true,
                    user: { select: { email: true } },
                },
            });
            if (!notification || !isNotificationType(notification.type)) {
                await finish(row.id, {
                    status: DeliveryStatus.FAILED,
                    lastError: "unknown_notification",
                    leaseExpiresAt: null,
                });
                result.failed += 1;
                continue;
            }

            const sendResult = await provider.send({
                to: notification.user.email,
                templateKey: notification.type,
                params: toNotificationParams(notification.params),
                idempotencyKey: `${notification.dedupeKey}:email`,
            });

            if (sendResult.ok) {
                await finish(row.id, {
                    status: DeliveryStatus.SENT,
                    sentAt: now,
                    providerMessageId: sendResult.providerMessageId,
                    leaseExpiresAt: null,
                    lastError: null,
                });
                result.sent += 1;
                continue;
            }

            console.error("[Notifications:dispatch] delivery failed", {
                deliveryId: row.id,
                errorKind: sendResult.errorKind,
                retryable: sendResult.retryable,
            });
            if (sendResult.retryable) {
                await finish(row.id, {
                    status: DeliveryStatus.PENDING,
                    lastError: sendResult.errorKind,
                    leaseExpiresAt: new Date(
                        now.getTime() + backoffMs(row.attemptCount + 1)
                    ),
                });
                result.retried += 1;
            } else {
                await finish(row.id, {
                    status: DeliveryStatus.FAILED,
                    lastError: sendResult.errorKind,
                    leaseExpiresAt: null,
                });
                result.failed += 1;
            }
        } catch (error: unknown) {
            // DB の失敗。行は SENDING のまま残り、リース切れで拾い直される
            logError(
                `[Notifications:dispatch] delivery ${row.id} errored`,
                error
            );
            result.failed += 1;
        }
    }

    return result;
};
