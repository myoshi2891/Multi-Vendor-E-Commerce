"use client";

import { UserButton } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";

// 購読する外部ストアは無い。server / client snapshot の差だけを利用する
const subscribe = () => () => {};

/**
 * Clerk の `UserButton` を hydration 完了後にのみ描画するラッパー。
 *
 * Clerk の `withClerk` は React state ではなくライブな `clerk.loaded` で描画を分岐するため、
 * SSR（常に未ロード → null）と、clerk-js が先にロードされた状態での hydration（DOM を出力）とで
 * HTML が食い違い hydration エラーになる。`useSyncExternalStore` の server snapshot は
 * SSR と hydration の両方で使われるため、両者は必ず `null` で一致し、hydration 後に描画へ切り替わる。
 *
 * @returns hydration 完了後は `UserButton`、それまでは `null`
 */
export default function ClientUserButton() {
    const hydrated = useSyncExternalStore(
        subscribe,
        () => true,
        () => false
    );
    if (!hydrated) return null;

    // Clerk 内部 DOM（.cl-avatarBox）への CSS 依存を避け、公式 API で指定する
    return (
        <UserButton appearance={{ elements: { avatarBox: "size-[70px]" } }} />
    );
}
