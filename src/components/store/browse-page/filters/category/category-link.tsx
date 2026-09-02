"use client";
import { CategoryTreeType } from "@/lib/types";
import { Minus, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * カテゴリツリーの 1 ノードと、その子孫を再帰的に描画する。
 *
 * カテゴリツリー Phase B（plan 067）で 2 段固定から再帰へ変えた。深さを固定すると
 * 3 階層目以降が**描画されないだけでなく、絞り込み手段そのものが存在しない**ことになる。
 *
 * リンクの生成は `?category=<slug>` に一本化してある。slug はグローバル一意
 * （design.md §2-Q1）なので、どの深さのノードでも 1 つのパラメータで指せる。
 * `?subCategory=` は外部被リンクのために受理し続けるが、こちらからは生成しない
 * （/browse が正準 URL へ 308 で寄せる）。
 */
export default function CategoryLink({
    category,
}: {
    category: CategoryTreeType;
}) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    const categoryQuery = searchParams.get("category");
    const hasChildren = category.children.length > 0;

    // 選択中のノードを含む枝は開いた状態で描く。閉じたままだと、リロード後に
    // 「絞り込みが効いているのに、その項目が画面上のどこにも無い」状態になる。
    const containsSelection = (node: CategoryTreeType): boolean =>
        node.url === categoryQuery || node.children.some(containsSelection);

    const [expand, setExpand] = useState<boolean>(() =>
        category.children.some(containsSelection)
    );

    const handleCategoryChange = (slug: string) => {
        if (slug === categoryQuery) return;
        const params = new URLSearchParams(searchParams);
        // 正準パラメータは category 1 本。旧 subCategory が残っていると
        // 2 つのサブツリーの積になり、意図しない絞り込みが残る。
        params.delete("subCategory");
        params.set("category", slug);
        replace(`${pathname}?${params.toString()}`);
        setExpand(true);
    };

    return (
        <section>
            <div className="relative mt-2 flex w-full items-center justify-between leading-5">
                <button
                    type="button"
                    aria-pressed={category.url === categoryQuery}
                    className="flex cursor-pointer select-none items-center whitespace-nowrap text-left"
                    onClick={() => handleCategoryChange(category.url)}
                >
                    <span className="relative mr-2 grid size-3 place-items-center rounded-full border border-border">
                        {category.url === categoryQuery && (
                            <div className="inline-block size-1.5 rounded-full bg-foreground"></div>
                        )}
                    </span>
                    <div className="inline-block flex-1 overflow-visible text-clip whitespace-normal text-xs">
                        {category.name}
                    </div>
                </button>
                {hasChildren && (
                    <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => setExpand((prev) => !prev)}
                        aria-expanded={expand}
                        aria-label={expand ? "Collapse" : "Expand"}
                    >
                        {expand ? (
                            <Minus className="w-3" />
                        ) : (
                            <Plus className="w-3" />
                        )}
                    </button>
                )}
            </div>
            {hasChildren && expand && (
                <div className="pl-5">
                    {category.children.map((child) => (
                        <CategoryLink key={child.id} category={child} />
                    ))}
                </div>
            )}
        </section>
    );
}
