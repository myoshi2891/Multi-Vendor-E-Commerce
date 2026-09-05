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

    const hasSelectedDescendant = category.children.some(containsSelection);

    const [expand, setExpand] = useState<boolean>(hasSelectedDescendant);

    // URL 由来の選択変化に追随する。`useState` の初期化子はマウント時に 1 度しか
    // 走らないが、この枝はクライアント遷移（`replace`）や戻る/進むを跨いで
    // **マウントされたまま** `?category=` が変わる。同期しないと、別の枝から
    // 子孫が選択されたとき「絞り込みが効いているのに項目が画面に無い」状態に戻る。
    //
    // 同期は **useEffect ではなくレンダー中の調整**で行う（React 公式の
    // "adjusting state when a prop changes"）。effect で setState すると
    // カスケードレンダーになり、`react-hooks` の set-state-in-effect にも触れる。
    //
    // **開く方向にしか同期しない。** `setExpand(hasSelectedDescendant)` と書くと
    // 選択が外れた瞬間にユーザーが自分で開いた枝を勝手に畳んでしまう。
    const [prevHasSelectedDescendant, setPrevHasSelectedDescendant] = useState(
        hasSelectedDescendant
    );
    if (hasSelectedDescendant !== prevHasSelectedDescendant) {
        setPrevHasSelectedDescendant(hasSelectedDescendant);
        if (hasSelectedDescendant) setExpand(true);
    }

    const handleCategoryChange = (slug: string) => {
        // 早期リターンは「すでに正準な選択を選び直した」ときだけ。
        // `slug === categoryQuery` だけで返すと、`?category=camera&subCategory=lens`
        // のように **stale なパラメータが残った状態**で選択中のノードを押したとき、
        // 正準化（subCategory の除去・重複 category の一本化）を行う手段が
        // 画面上から消える —— 表示は camera が選択済みなのに、実際の絞り込みは
        // 2 つのサブツリーの積のまま、という状態から抜けられなくなる。
        const isCanonicalSelection =
            slug === categoryQuery &&
            searchParams.getAll("category").length === 1 &&
            !searchParams.has("subCategory");
        if (isCanonicalSelection) return;

        const params = new URLSearchParams(searchParams);
        // 正準パラメータは category 1 本。旧 subCategory が残っていると
        // 2 つのサブツリーの積になり、意図しない絞り込みが残る。
        params.delete("subCategory");
        // 絞り込みを変えたらページャは 1 ページ目へ戻す。残すと「3 ページ目を見ている
        // 状態で別カテゴリを選ぶ」と、新しい結果集合の 3 ページ目という
        // ユーザーが指定していない位置に着地する（件数が足りなければ
        // /browse 側の正準化で 1 ページ目へ寄るが、足りる場合は寄らない）。
        params.delete("page");
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
