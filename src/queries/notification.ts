"use server";

import { db } from "@/lib/db";
import { logError } from "@/lib/log";
import { requireUser } from "@/lib/auth-guards";
import { normalizePositiveIntParam } from "@/lib/utils";
import { isNotificationType } from "@/lib/notifications/mapping";
import {
    NOTIFICATION_TEMPLATES,
    toNotificationParams,
} from "@/lib/notifications/templates";

/**
 * src/queries/notification.ts
 * アプリ内通知（ベル・通知一覧）のサーバーアクション層。plan 086 / design §2.1。
 *
 * - getMyNotifications         : 自分の通知を新しい順にカーソルページングで取得
 * - getUnreadNotificationCount : 自分の未読件数（ベルのバッジ）
 * - markNotificationRead       : 1 件を既読化（where に userId を入れて IDOR を防ぐ）
 * - markAllNotificationsRead   : 自分の未読を一括で既読化
 *
 * 認可（requireUser）は try/catch の外で呼ぶ。"Unauthenticated." を汎用 DB エラーで
 * 上書きしないため（tech.md「認可ガード」）。
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type NotificationListItem = {
    id: string;
    title: string;
    body: string;
    linkUrl: string | null;
    isRead: boolean;
    /** ISO 8601（Client Component へそのまま渡せるよう文字列にする） */
    createdAt: string;
};

/**
 * @function getMyNotifications
 * @description 自分の通知を新しい順に取得する。limit は 1〜50 にクランプし、
 *              limit + 1 件を読んで次ページの有無を判定する。未知の種別の行は表示しない。
 * @access USER
 */
export const getMyNotifications = async (
    opts: { cursor?: string; limit?: unknown } = {}
): Promise<{ items: NotificationListItem[]; nextCursor: string | null }> => {
    const user = await requireUser();
    const limit = normalizePositiveIntParam(opts.limit, {
        fallback: DEFAULT_LIMIT,
        max: MAX_LIMIT,
    });
    const cursor = opts.cursor?.trim();

    let rows: {
        id: string;
        type: string;
        params: unknown;
        linkUrl: string | null;
        isRead: boolean;
        createdAt: Date;
    }[];
    try {
        rows = await db.notification.findMany({
            where: { userId: user.id },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                type: true,
                params: true,
                linkUrl: true,
                isRead: true,
                createdAt: true,
            },
        });
    } catch (error: unknown) {
        logError("[Notification:getMyNotifications] Failed to load", error);
        throw new Error("Failed to load notifications.");
    }

    const page = rows.slice(0, limit);
    const items: NotificationListItem[] = [];
    for (const row of page) {
        if (!isNotificationType(row.type)) continue;
        const template = NOTIFICATION_TEMPLATES[row.type];
        const params = toNotificationParams(row.params);
        items.push({
            id: row.id,
            title: template.title(params),
            body: template.body(params),
            linkUrl: row.linkUrl,
            isRead: row.isRead,
            createdAt: row.createdAt.toISOString(),
        });
    }

    const last = page.at(-1);
    return {
        items,
        nextCursor: rows.length > limit && last ? last.id : null,
    };
};

/**
 * @function getUnreadNotificationCount
 * @description 自分の未読件数（@@index([userId, isRead, createdAt]) を使う）。
 * @access USER
 */
export const getUnreadNotificationCount = async (): Promise<number> => {
    const user = await requireUser();
    try {
        return await db.notification.count({
            where: { userId: user.id, isRead: false },
        });
    } catch (error: unknown) {
        logError(
            "[Notification:getUnreadNotificationCount] Failed to count",
            error
        );
        throw new Error("Failed to load notifications.");
    }
};

/**
 * @function markNotificationRead
 * @description 1 件を既読化する。where に userId を入れるので、他人の通知 ID では
 *              0 件になり何も変わらない（IDOR 防止）。再実行しても結果は変わらない（冪等）。
 * @access USER
 */
export const markNotificationRead = async (
    id: string
): Promise<{ count: number }> => {
    const user = await requireUser();
    const notificationId = typeof id === "string" ? id.trim() : "";
    if (!notificationId) throw new Error("Invalid notification id.");

    try {
        const result = await db.notification.updateMany({
            where: { id: notificationId, userId: user.id, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        return { count: result.count };
    } catch (error: unknown) {
        logError("[Notification:markNotificationRead] Failed to update", error);
        throw new Error("Failed to update notifications.");
    }
};

/**
 * @function markAllNotificationsRead
 * @description 自分の未読を一括で既読化する（markConversationRead と同じ形）。
 * @access USER
 */
export const markAllNotificationsRead = async (): Promise<{
    count: number;
}> => {
    const user = await requireUser();
    try {
        const result = await db.notification.updateMany({
            where: { userId: user.id, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        return { count: result.count };
    } catch (error: unknown) {
        logError(
            "[Notification:markAllNotificationsRead] Failed to update",
            error
        );
        throw new Error("Failed to update notifications.");
    }
};
