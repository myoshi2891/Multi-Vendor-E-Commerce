"use client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";

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

/** sort クエリが未指定 / 未知の値だったときに採用する既定の選択肢。 */
const DEFAULT_SORT = sortArray[0];

export default function ProductSort() {
    const searchParams = useSearchParams();
    const params = new URLSearchParams(searchParams);
    const pathname = usePathname();

    const { replace } = useRouter();

    // 未知の値（手打ち URL 等）は既定の選択肢へ正規化する。ラベルと
    // RadioGroup の value / 太字判定が同じ値を参照するため、「Most Popular と
    // 表示されているのに aria-checked がどれも false」という不整合を防ぐ。
    const activeSort =
        sortArray.find((s) => s.query === params.get("sort")) ?? DEFAULT_SORT;
    const sortQuery = activeSort.query;
    const sort = activeSort.name;

    const handleSort = (sort: string) => {
        params.set("sort", sort);
        replace(`${pathname}?${params.toString()}`);
    };

    // 開閉状態はシェブロンの回転にのみ使う（開閉制御そのものは Radix が持つ）。
    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

    // 可視ラベル "Sort by" とトリガーボタンを紐付ける ID。静的 ID だと同一ページに
    // Sort が複数描画された際に衝突するため、React の useId で一意化する
    // （SSR/CSR で同値）。
    const sortLabelId = useId();
    const sortTriggerId = useId();

    return (
        <div className="duration-[30ms] relative w-full transition-all">
            <div className="relative inline-block pr-[50px]">
                <div className="flex">
                    <div className="!float-right h-9 w-[227px]">
                        <div className="!float-left h-9 w-[227px]">
                            <div className="group relative z-20 inline-block h-9 w-[227px] outline-0">
                                {/* Trigger + Menu。role="menu" を手書きせず Radix の
                                    DropdownMenu に委譲することで、ArrowUp/ArrowDown /
                                    Home/End / 先頭文字タイプアヘッド / Escape での
                                    トリガーへのフォーカス復帰 / aria-checked を
                                    プリミティブ側が担保する（ARIA APG menu パターン）。 */}
                                <DropdownMenu
                                    open={isMenuOpen}
                                    onOpenChange={setIsMenuOpen}
                                >
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
                                                （WCAG 2.1.1）、メニューボタンパターンにする。
                                                aria-haspopup / aria-expanded / aria-controls は
                                                DropdownMenuTrigger が付与する。 */}
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    id={sortTriggerId}
                                                    type="button"
                                                    // 「Sort by」＋現在値（例: Most Popular）を
                                                    // 合成してアクセシブル名にする。
                                                    aria-labelledby={`${sortLabelId} ${sortTriggerId}`}
                                                    className="h-9 w-full cursor-pointer border bg-transparent bg-none px-3 pl-[70px] pr-10 text-left align-bottom text-sm font-bold text-main-primary"
                                                >
                                                    {sort}
                                                </button>
                                            </DropdownMenuTrigger>
                                            <div className="relative">
                                                <span
                                                    className="pointer-events-none absolute right-0 top-0 box-border flex h-full w-10 items-center justify-center transition-transform duration-200 ease-in-out"
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
                                    <DropdownMenuContent
                                        align="start"
                                        sideOffset={0}
                                        className="max-h-72 w-[227px] overflow-auto py-2"
                                    >
                                        <DropdownMenuRadioGroup
                                            value={sortQuery}
                                            onValueChange={handleSort}
                                        >
                                            {sortArray.map((option) => (
                                                <DropdownMenuRadioItem
                                                    key={option.query}
                                                    value={option.query}
                                                    className="h-8 cursor-pointer rounded-none px-4 pl-8 text-xs"
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
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
