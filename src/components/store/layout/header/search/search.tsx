"use client";
import { SearchResult } from "@/lib/types";
import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useRef, useState } from "react";
import SearchSuggestions from "./suggestions";

/**
 * A search form component that provides real-time product suggestions and navigates to search results.
 *
 * Initializes the search query from the URL's `search` parameter. Fetches product suggestions as the user types (queries must be at least 2 characters). On form submission, navigates to `/browse` with the search query, or updates the search parameter in-place if already on `/browse`. Automatically aborts previous requests when new searches are initiated.
 */
export default function Search() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const params = new URLSearchParams(searchParams);
    const { push, replace } = useRouter();

    const search_query_url = params.get("search");
    const [searchQuery, setSearchQuery] = useState<string>(
        search_query_url || ""
    );
    const [suggestions, setSuggestions] = useState<SearchResult[]>([]);

    // 直前のリクエストをキャンセルするためのコントローラ
    const abortRef = useRef<AbortController | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pathname !== "/browse") {
            push(`/browse?search=${encodeURIComponent(searchQuery)}`);
        } else {
            if (!searchQuery) {
                params.delete("search");
            } else {
                params.set("search", searchQuery);
            }
            replace(`${pathname}?${params.toString()}`);
        }
    };

    const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);

        // ★ /browse でもサジェストしたいので早期 return を削除
        const trimmed = value.trim();
        if (trimmed.length < 2) {
            setSuggestions([]);
            // 進行中のリクエストがあれば止める
            abortRef.current?.abort();
            return;
        }

        // 直前のリクエストをキャンセル
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch(
                `/api/search-products?search=${encodeURIComponent(trimmed)}`,
                { signal: controller.signal }
            );

            if (!res.ok) {
                // API が 4xx/5xx のときは空で更新（コンソールだけ残す）
                console.error("Search API failed:", res.status, res.statusText);
                setSuggestions([]);
                return;
            }

            const data = await res.json();

            // // 配列 or {results: [...]}/{items: [...]} のどれでも拾えるようにする
            // const items: SearchResult[] = Array.isArray(data)
            //     ? data
            //     : (data?.results ?? data?.items ?? []);

            // // setSuggestions(Array.isArray(items) ? items : []);
            // setSuggestions(data.products || []);
            const items: SearchResult[] = Array.isArray(data)
                ? data
                : (data?.products ?? data?.results ?? data?.items ?? []);

            // 必須キーが揃っているものだけ残す
            const validItems = items.filter(
                (item) => item.link && item.name && item.image
            );

            setSuggestions(validItems);
        } catch (err: any) {
            if (err?.name !== "AbortError") {
                console.error("Failed to fetch search results:", err);
                setSuggestions([]);
            }
        }
    };

    return (
        <div className="relative flex-1 lg:w-full">
            <form
                onSubmit={handleSubmit}
                className="relative flex h-10 rounded-3xl border-none bg-white"
            >
                <input
                    type="text"
                    placeholder="Search..."
                    className="m-2.5 flex-1 border-none bg-white pl-2.5 text-black outline-none"
                    value={searchQuery}
                    onChange={handleInputChange}
                />
                {suggestions.length > 0 && (
                    <SearchSuggestions
                        suggestions={suggestions}
                        query={searchQuery}
                    />
                )}
                <button
                    type="submit"
                    aria-label="Search"
                    className="mb-0 ml-0 mr-1 mt-1 grid h-8 w-[56px] cursor-pointer place-items-center rounded-[20px] border bg-gradient-to-r from-slate-500 to-slate-600"
                >
                    <SearchIcon />
                </button>
            </form>
        </div>
    );
}
