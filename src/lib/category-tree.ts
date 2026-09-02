import { db } from "@/lib/db";
import { CategoryAliasSource } from "@prisma/client";

/**
 * カテゴリツリーの DB 依存ヘルパー。
 *
 * **純粋なヘルパー（prefix 境界・path 計算・木の組み立て）は
 * [`category-path.ts`](./category-path.ts) にある。** `"use client"` の
 * フォームからも使うため、`@/lib/db` に依存しないモジュールへ分けてある。
 * 呼び出し側の import を割らずに済むよう、ここから再輸出する。
 */
export {
    MAX_CATEGORY_DEPTH,
    subtreeOf,
    isWithinSubtree,
    depthOfPath,
    rebasePath,
    toCanonicalCategorySlug,
    buildCategoryTree,
    flattenCategoryTree,
} from "./category-path";
export type { CategoryTreeInput, CategoryTreeNode } from "./category-path";

const SELECT_NODE = { id: true, path: true, url: true } as const;

/** slug 解決の結果。ツリー検索に必要な最小限だけを返す。 */
export interface ResolvedCategoryNode {
    id: string;
    /** サブツリー検索の prefix キー */
    path: string;
    /** 正準 slug。308 リダイレクトの行き先に使う */
    url: string;
}

/**
 * Resolve a URL slug to a category node, falling back to the rename alias table.
 *
 * design.md §2-Q3 の解決順序をそのままコードにしている。**順序が entityType で
 * 非対称である点が重要**:
 *
 * - `CATEGORY`: 正準 slug は移行で温存されているので **url 完全一致が先**。
 * - `SUB_CATEGORY`: 移行時にリネームされ得るため **別名表が先**。旧 slug は
 *   グローバル一意の制約下で**別のノードの正準 slug になっている可能性がある**ので、
 *   url 完全一致を先に引くと無関係なノードへ着地する。
 *
 * 解決できない slug には `null` を返す。呼び出し側は**フィルタを黙って捨てず**
 * 0 件を返すこと（fail-closed。捨てると「該当なし」が「全カタログ表示」に化ける）。
 *
 * @param slug - URL から来た slug
 * @param entityType - `?category=` なら `CATEGORY`、`?subCategory=` なら `SUB_CATEGORY`
 * @returns 解決されたノード、または `null`
 */
export const resolveCategoryNode = async (
    slug: string,
    entityType: CategoryAliasSource
): Promise<ResolvedCategoryNode | null> => {
    const byUrl = async (): Promise<ResolvedCategoryNode | null> =>
        db.category.findUnique({ where: { url: slug }, select: SELECT_NODE });

    const byAlias = async (): Promise<ResolvedCategoryNode | null> => {
        const alias = await db.categorySlugAlias.findUnique({
            where: { entityType_oldSlug: { entityType, oldSlug: slug } },
            select: { category: { select: SELECT_NODE } },
        });
        return alias?.category ?? null;
    };

    try {
        return entityType === "SUB_CATEGORY"
            ? ((await byAlias()) ?? (await byUrl()))
            : ((await byUrl()) ?? (await byAlias()));
    } catch (error: unknown) {
        // **握り潰さない。** `null` は「解決できない slug」を意味し、呼び出し側は
        // それを 0 件（fail-closed）へ変換する。DB 障害をここで `null` に畳むと
        // 「該当なし」と区別できなくなるため、文脈だけ記録して元の例外を再送出する。
        const context = { slug, entityType };
        if (error instanceof Error) {
            console.error("[CategoryTree:resolveCategoryNode] Lookup failed", {
                ...context,
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error(
                "[CategoryTree:resolveCategoryNode] Unknown lookup failure",
                { ...context, error }
            );
        }
        throw error;
    }
};
