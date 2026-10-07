import type { db } from "@/lib/db";
import type { NotificationType } from "./mapping";
import type { NotificationParams } from "./templates";

/**
 * db.$transaction のコールバックが受け取る tx の型（Accelerate 拡張済みクライアント）。
 * 素の Prisma.TransactionClient とは非互換のため、`order.ts` の
 * `OrderTransactionClient` と同じく $transaction から導出する。
 */
export type NotificationTx = Parameters<
    Parameters<typeof db.$transaction>[0]
>[0];

/** 発火点が組み立てる通知イベント（design §3.1） */
export type NotificationEvent = {
    type: NotificationType;
    recipientUserId: string;
    /** 発生源へのポリモーフィック参照 */
    source: { type: string; id: string };
    /** 遷移の識別子（dedupeKey の一部） */
    transition: string;
    params: NotificationParams;
    /** アプリ内の相対パスのみ */
    linkUrl?: `/${string}`;
};
