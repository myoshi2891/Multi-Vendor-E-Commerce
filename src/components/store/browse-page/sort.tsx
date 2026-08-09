"use client";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, useState } from "react";

const sortArray = [
    {
        name: "Most Popular",
        query: "most-popular",
    },
    {
        name: "New Arrivals",
        query: "new-arrivals",
    },
    {
        name: "Top Rated",
        query: "top-rated",
    },
    {
        name: "Price low to high",
        query: "price-low-to-high",
    },
    {
        name: "Price High to low",
        query: "price-high-to-low",
    },
];
export default function ProductSort() {
    const searchParams = useSearchParams();
    const params = new URLSearchParams(searchParams);
    const pathname = usePathname();

    const { replace } = useRouter();

    const sortQuery = params.get("sort") || "most-popular";
    const sort = sortQuery
        ? sortArray.find((s) => s.query === sortQuery)?.name
        : "Most Popular";

    const handleSort = (sort: string) => {
        params.set("sort", sort);
        replace(`${pathname}?${params.toString()}`);
    };

    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

    // 可視ラベル "Sort by" とトリガーボタン / メニューを紐付ける ID。静的 ID だと
    // 同一ページに Sort が複数描画された際に衝突するため、React の useId で
    // 一意化する（SSR/CSR で同値）。
    const sortLabelId = useId();
    const sortTriggerId = useId();
    const sortMenuId = useId();

    // Escape でメニューを閉じたあと、フォーカスをトリガーへ戻すために保持する。
    const triggerRef = useRef<HTMLButtonElement>(null);

    const selectSort = (query: string) => {
        handleSort(query);
        setIsMenuOpen(false);
        triggerRef.current?.focus();
    };

    return (
        <div className="duration-[30ms] relative w-full transition-all">
            <div className="relative inline-block pr-[50px]">
                <div className="flex">
                    <div className="!float-right h-9 w-[227px]">
                        <div className="!float-left h-9 w-[227px]">
                            <div
                                className="group relative z-20 inline-block h-9 w-[227px] outline-0"
                                onMouseEnter={() => setIsMenuOpen(true)}
                                onMouseLeave={() => setIsMenuOpen(false)}
                                onKeyDown={(e) => {
                                    if (e.key !== "Escape" || !isMenuOpen)
                                        return;
                                    setIsMenuOpen(false);
                                    triggerRef.current?.focus();
                                }}
                            >
                                {/* Trigger */}
                                <div className="h-9 w-[227px]">
                                    <div className="relative inline-flex w-full">
                                        <div className="relative">
                                            <span
                                                id={sortLabelId}
                                                className="duration-[20ms] pointer-events-none absolute top-0 z-10 flex h-full w-[70px] items-center justify-center transition-all"
                                            >
                                                Sort by
                                            </span>
                                        </div>
                                        {/* キーボード操作可能な実ボタン。disabled な
                                            <input> ではフォーカスも開閉もできないため
                                            （WCAG 2.1.1）、メニューボタンパターンにする。 */}
                                        <button
                                            ref={triggerRef}
                                            id={sortTriggerId}
                                            type="button"
                                            aria-haspopup="menu"
                                            aria-expanded={isMenuOpen}
                                            aria-controls={sortMenuId}
                                            // 「Sort by」＋現在値（例: Most Popular）を
                                            // 合成してアクセシブル名にする。
                                            aria-labelledby={`${sortLabelId} ${sortTriggerId}`}
                                            onClick={() =>
                                                setIsMenuOpen((open) => !open)
                                            }
                                            className="h-9 w-full cursor-pointer border bg-transparent bg-none px-3 pl-[70px] pr-10 text-left align-bottom text-sm font-bold text-main-primary"
                                        >
                                            {sort}
                                        </button>
                                        <div className="relative">
                                            <span
                                                className="absolute right-0 top-0 box-border flex h-full w-10 items-center justify-center transition-transform duration-200 ease-in-out"
                                                style={{
                                                    transform: isMenuOpen
                                                        ? "rotate(180deg)"
                                                        : "rotate(0deg)",
                                                }}
                                            >
                                                <ChevronDown className="w-3" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {/* Menu */}
                                <ul
                                    id={sortMenuId}
                                    role="menu"
                                    aria-labelledby={sortTriggerId}
                                    className={cn(
                                        "absolute max-h-72 w-full overflow-auto bg-white py-2 shadow-2xl transition-all duration-300 ease-in-out",
                                        {
                                            "visible translate-y-0 opacity-100":
                                                isMenuOpen,
                                            // invisible は opacity-0 と違いタブ順から
                                            // 外れるため、閉じている間に項目へ
                                            // キーボードフォーカスが入らない。
                                            "invisible pointer-events-none -translate-y-2 opacity-0":
                                                !isMenuOpen,
                                        }
                                    )}
                                >
                                    {sortArray.map((option) => (
                                        <li key={option.query} role="none">
                                            <button
                                                type="button"
                                                role="menuitem"
                                                aria-current={
                                                    option.query === sortQuery
                                                }
                                                className="flex h-8 w-full cursor-pointer items-center justify-between bg-white px-4 text-xs hover:bg-gray-100"
                                                onClick={() =>
                                                    selectSort(option.query)
                                                }
                                            >
                                                <span
                                                    className={cn({
                                                        "font-bold":
                                                            option.query ===
                                                            sortQuery,
                                                    })}
                                                >
                                                    {option.name}
                                                </span>
                                                {option.query === sortQuery && (
                                                    <Check className="w-3" />
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
