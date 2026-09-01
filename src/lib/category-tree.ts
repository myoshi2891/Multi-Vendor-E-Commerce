import { db } from "@/lib/db";
import { CategoryAliasSource } from "@prisma/client";

/**
 * カテゴリツリー（materialized path）の共通ヘルパー。
 *
 * ADR-006 / `docs/design/category-tree/design.md` §2-Q1 の決定に対応する。
 * `Category.path` は区切り文字を末尾に付けずに保存されている（例: `"electronics/camera"`）。
 */

/**
 * Build a Prisma `where` fragment matching a category node and all of its descendants.
 *
 * **prefix 境界をこの関数の外で書かないこと。** 素の `startsWith(path)` は
 * `electronics/camera` が `electronics/camera-accessories` を拾う —— 兄弟が
 * 子孫に化けるため、絞り込みが黙って緩くなる。境界文字 `/` を必ず伴う形は
 * ここ 1 箇所に閉じ込め、呼び出し側には条件を組み立てさせない。
 *
 * slug は Zod で `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` に制約されており、`/` と
 * LIKE のメタ文字（`%` `_`）を含まない。したがって `startsWith` に渡す値の
 * エスケープは不要である（design.md §2-Q1）。**この制約を緩める場合は
 * ここのエスケープ不要という前提が崩れる。**
 *
 * @param path - 対象ノードの `Category.path`（末尾に `/` を付けない）
 * @returns `{ OR: [完全一致, 子孫] }` の形の Prisma where 断片
 */
export const subtreeOf = (path: string) =>
    ({
        OR: [{ path }, { path: { startsWith: `${path}/` } }],
    }) as const;

/** slug 解決の結果。ツリー検索に必要な最小限だけを返す。 */
export interface ResolvedCategoryNode {
    id: string;
    /** サブツリー検索の prefix キー */
    path: string;
    /** 正準 slug。308 リダイレクトの行き先に使う */
    url: string;
}

const SELECT_NODE = { id: true, path: true, url: true } as const;

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

    return entityType === "SUB_CATEGORY"
        ? ((await byAlias()) ?? (await byUrl()))
        : ((await byUrl()) ?? (await byAlias()));
};
