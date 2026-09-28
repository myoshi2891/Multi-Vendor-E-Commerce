"use client";

import type { ReactNode } from "react";

const TARGET = "/#collections";

/**
 * 商品取得失敗時の再試行リンク。ホーム上で `/#collections` へ遷移しても
 * 同一ドキュメント内のフラグメント遷移で終わり再取得されないため、
 * URL をコレクション位置へ揃えてからページを再読み込みする。
 * JS 無効時は href による通常遷移へフォールバックする。
 */
export default function RetryLink({
    children,
}: Readonly<{ children: ReactNode }>) {
    return (
        <a
            href={TARGET}
            onClick={(event) => {
                event.preventDefault();
                // Next.js ルーターの履歴 state を保ったまま URL だけ差し替える
                window.history.replaceState(window.history.state, "", TARGET);
                window.location.reload();
            }}
        >
            {children}
        </a>
    );
}
