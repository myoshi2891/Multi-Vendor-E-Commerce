"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { NotificationListItem } from "@/queries/notification";
import profileStyles from "../profile.module.css";
import styles from "./notifications.module.css";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
});

/**
 * 通知一覧（plan 086）。既読化は Server Action を props で受け取る
 * （UI から src/queries を直接呼ばない・messages-container と同じ形）。
 */
export default function NotificationList({
    initialItems,
    nextCursor,
    markReadAction,
    markAllReadAction,
}: Readonly<{
    initialItems: NotificationListItem[];
    nextCursor: string | null;
    markReadAction: (id: string) => Promise<{ count: number }>;
    markAllReadAction: () => Promise<{ count: number }>;
}>) {
    const [items, setItems] = useState(initialItems);
    const [error, setError] = useState(false);
    const isMarkingAllRef = useRef(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);

    const hasUnread = items.some((item) => !item.isRead);

    const markAll = async () => {
        if (isMarkingAllRef.current) return; // 多重実行の防止（tech.md リエントランシーガード）
        isMarkingAllRef.current = true;
        setIsMarkingAll(true);
        setError(false);
        try {
            await markAllReadAction();
            setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
        } catch (err: unknown) {
            if (err instanceof Error) {
                console.error("[NotificationList:markAll] Failed", {
                    error: err.message,
                    stack: err.stack,
                });
            } else {
                console.error("[NotificationList:markAll] Unknown error", {
                    error: err,
                });
            }
            setError(true);
        } finally {
            isMarkingAllRef.current = false;
            setIsMarkingAll(false);
        }
    };

    // 開いた通知を既読にする。画面遷移を止めないよう待たずに投げ、失敗はログに残す
    // （未読のまま残るだけで、次に開いたときにもう一度既読化される）。
    // リンク先の無い通知は遷移しないので optimistic: false で成功後に既読表示へ切り替え、
    // 失敗時は未読のボタンを残して押し直せるようにする
    const markOne = (id: string, { optimistic = true } = {}) => {
        const applyRead = () =>
            setItems((prev) =>
                prev.map((item) =>
                    item.id === id ? { ...item, isRead: true } : item
                )
            );
        if (optimistic) applyRead();
        void markReadAction(id).then(
            optimistic ? undefined : applyRead,
            (err: unknown) => {
                if (err instanceof Error) {
                    console.error("[NotificationList:markOne] Failed", {
                        error: err.message,
                        stack: err.stack,
                    });
                } else {
                    console.error("[NotificationList:markOne] Unknown error", {
                        error: err,
                    });
                }
            }
        );
    };

    return (
        <section aria-labelledby="notifications-title">
            <div className={profileStyles.pageHeading}>
                <p className={profileStyles.eyebrow}>WHAT&apos;S NEW</p>
                <h1 id="notifications-title">Notifications</h1>
                <p lang="ja">ご注文の発送やお届けをお知らせします。</p>
            </div>

            {items.length === 0 ? (
                <p className={profileStyles.unavailable}>
                    No notifications yet.
                </p>
            ) : (
                <>
                    <div className={styles.toolbar}>
                        <button
                            type="button"
                            onClick={markAll}
                            disabled={!hasUnread || isMarkingAll}
                            className={styles.markAll}
                        >
                            Mark all as read
                        </button>
                    </div>
                    {error ? (
                        <p role="alert" className={profileStyles.error}>
                            Couldn&apos;t update notifications. Please try
                            again.
                        </p>
                    ) : null}
                    <ul className={styles.list}>
                        {items.map((item) => {
                            const content = (
                                <>
                                    <span className={styles.titleRow}>
                                        <span className={styles.title}>
                                            {item.title}
                                        </span>
                                        {item.isRead ? null : (
                                            <span className={styles.unread}>
                                                Unread
                                            </span>
                                        )}
                                    </span>
                                    <span className={styles.body}>
                                        {item.body}
                                    </span>
                                    <time
                                        dateTime={item.createdAt}
                                        className={styles.time}
                                    >
                                        {dateFormatter.format(
                                            new Date(item.createdAt)
                                        )}
                                    </time>
                                </>
                            );
                            return (
                                <li key={item.id} className={styles.item}>
                                    {item.linkUrl ? (
                                        <Link
                                            href={item.linkUrl}
                                            className={styles.link}
                                            onClick={
                                                item.isRead
                                                    ? undefined
                                                    : () => markOne(item.id)
                                            }
                                        >
                                            {content}
                                        </Link>
                                    ) : item.isRead ? (
                                        <div className={styles.link}>
                                            {content}
                                        </div>
                                    ) : (
                                        // リンク先の無い未読は、開く代わりにボタンで既読にする
                                        <button
                                            type="button"
                                            className={`${styles.link} ${styles.asButton}`}
                                            onClick={() =>
                                                markOne(item.id, {
                                                    optimistic: false,
                                                })
                                            }
                                        >
                                            {content}
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
            {/* 未知の種別だけのページは items が空でも続きがあるので、空状態でも出す */}
            {nextCursor ? (
                <Link
                    href={`/profile/notifications?cursor=${encodeURIComponent(nextCursor)}`}
                    className={styles.older}
                >
                    Older notifications
                </Link>
            ) : null}
        </section>
    );
}
