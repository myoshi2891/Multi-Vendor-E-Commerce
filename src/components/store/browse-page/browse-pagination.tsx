"use client";

import Pagination from "@/components/store/shared/pagination";
import { useRouter, useSearchParams } from "next/navigation";
import { SetStateAction } from "react";

/**
 * Provides pagination controls that navigate within the `/browse` route.
 *
 * Existing query parameters are preserved while the `page` parameter is updated.
 *
 * @param page - The current one-based page number
 * @param totalPages - The total number of pages
 * @returns Pagination controls for navigating between pages
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
