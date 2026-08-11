"use client";

import Pagination from "@/components/store/shared/pagination";
import { useRouter, useSearchParams } from "next/navigation";
import { SetStateAction } from "react";

/**
 * 共有ページャ（`src/components/store/shared/pagination.tsx`）を URL 遷移へ橋渡しする薄いラッパー。
 *
 * 共有ページャはクライアント state 前提の `setPage: Dispatch<SetStateAction<number>>` を受け取るため、
 * SSR の /browse でそのまま使えない。ここで「既存クエリを保持したまま `page` だけ差し替えて push」する
 * 関数へ変換する。フィルタ・ソートを保持するのはこのラッパーの責務であり、
 * `<Link href>` 直書きへ置き換えるとソート・フィルタの維持が壊れる。
 *
 * @param page - 現在のページ番号（1 始まり。呼び出し側で正規化済み）
 * @param totalPages - 総ページ数
 */
export default function BrowsePagination({
    page,
    totalPages,
}: {
    page: number;
    totalPages: number;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // 共有ページャは `setPage(i + 1)` と `setPage((prev) => prev + 1)` の両形式で呼ぶため、
    // 関数形式は現在ページを渡して解決する。
    const goTo = (next: SetStateAction<number>) => {
        const value = typeof next === "function" ? next(page) : next;
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(value));
        router.push(`/browse?${params.toString()}`);
    };

    return <Pagination page={page} totalPages={totalPages} setPage={goTo} />;
}
