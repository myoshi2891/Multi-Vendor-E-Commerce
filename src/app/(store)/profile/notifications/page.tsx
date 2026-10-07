import NotificationList from "@/components/store/profile/notifications/notification-list";
import profileStyles from "@/components/store/profile/profile.module.css";
import {
    getMyNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from "@/queries/notification";

export const dynamic = "force-dynamic";

/** URL の cursor は通知 ID（UUID）。それ以外の形は無視して 1 ページ目を出す */
const CURSOR_PATTERN = /^[0-9a-f-]{1,64}$/i;

const parseCursor = (
    raw: string | string[] | undefined
): string | undefined => {
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    return value && CURSOR_PATTERN.test(value) ? value : undefined;
};

/**
 * 通知一覧（plan 086）。認証は profile/layout.tsx が行い、データ取得側の
 * Server Action（requireUser）も各自で検証する。
 */
export default async function ProfileNotificationsPage({
    searchParams,
}: Readonly<{
    searchParams: Promise<{ cursor?: string | string[] }>;
}>) {
    const { cursor } = await searchParams;

    let page: Awaited<ReturnType<typeof getMyNotifications>>;
    try {
        page = await getMyNotifications({ cursor: parseCursor(cursor) });
    } catch {
        // 失敗の詳細は getMyNotifications が構造化ログに残している
        return (
            <p role="alert" className={profileStyles.error}>
                We couldn&apos;t load your notifications. Please try again
                later.
            </p>
        );
    }

    return (
        <NotificationList
            key={parseCursor(cursor) ?? "first"}
            initialItems={page.items}
            nextCursor={page.nextCursor}
            markReadAction={markNotificationRead}
            markAllReadAction={markAllNotificationsRead}
        />
    );
}
