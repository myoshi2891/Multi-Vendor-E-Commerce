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

/**
 * Report whether `path` is the ancestor path itself or one of its descendants.
 *
 * `subtreeOf` の TypeScript 版。**境界の定義を 2 箇所に散らさないため**、
 * DB 側（Prisma where）とアプリ側（URL 正準化の親子判定）の両方をここから引く。
 * 素の `startsWith(ancestor)` は `electronics/camera` が
 * `electronics/camera-accessories` を拾う点も同じ。
 *
 * @param path - 判定対象ノードの path
 * @param ancestorPath - 祖先候補の path
 * @returns 同一または子孫なら true
 */
export const isWithinSubtree = (path: string, ancestorPath: string): boolean =>
    path === ancestorPath || path.startsWith(`${ancestorPath}/`);

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

/** `buildCategoryTree` が読む最小の形。Prisma の `Category` はこれを満たす。 */
export interface CategoryTreeInput {
    id: string;
    parentId: string | null;
}

/** 木に組み上げた結果。入力の全プロパティを保ち、`children` を足す。 */
export type CategoryTreeNode<T extends CategoryTreeInput> = T & {
    children: CategoryTreeNode<T>[];
};

/**
 * Rebuild a nested category tree from a flat, query-ordered list of nodes.
 *
 * 並び替えはしない —— 各階層の順序は呼び出し側のクエリの `orderBy`
 * （`[{ depth: asc }, { sortOrder: asc }, { name: asc }]`）が決める。ここで
 * 並べ替えると順序の決定点が 2 つになる。
 *
 * **親が集合に無いノードはルートとして残す（捨てない）。** 祖先を取りこぼした枝を
 * 黙って落とすと、「店舗ページのカテゴリメニューが空」という形でしか表面化せず
 * 原因に辿り着けない。階層が 1 段浅く出るほうが検出可能である。
 *
 * @param nodes - depth 昇順のフラットなノード配列
 * @returns ルートノードの配列（各ノードに `children` が付く）
 */
export const buildCategoryTree = <T extends CategoryTreeInput>(
    nodes: readonly T[]
): CategoryTreeNode<T>[] => {
    const byId = new Map<string, CategoryTreeNode<T>>();
    for (const n of nodes) {
        byId.set(n.id, { ...n, children: [] });
    }

    const roots: CategoryTreeNode<T>[] = [];
    for (const n of nodes) {
        const built = byId.get(n.id);
        if (built === undefined) continue;
        const parent = n.parentId === null ? undefined : byId.get(n.parentId);
        if (parent === undefined) {
            roots.push(built);
            continue;
        }
        parent.children.push(built);
    }
    return roots;
};

/**
 * Flatten a category tree back into a depth-first (pre-order) list.
 *
 * `buildCategoryTree` の逆向き。木の形のまま「先頭 N 件」を取りたい呼び出し側
 * （footer のカテゴリリンク等）のために用意する。**並び替えはしない** ——
 * 順序は木を組んだ時点のクエリの `orderBy` が決めるという `buildCategoryTree`
 * の約束をここでも守る（並びの決定点を増やさない）。
 *
 * @param nodes - ルートノードの配列
 * @returns 親 → 子孫の順に並んだ平坦な配列
 */
export const flattenCategoryTree = <T extends CategoryTreeInput>(
    nodes: readonly CategoryTreeNode<T>[]
): CategoryTreeNode<T>[] => {
    const flat: CategoryTreeNode<T>[] = [];
    const visit = (list: readonly CategoryTreeNode<T>[]): void => {
        for (const node of list) {
            flat.push(node);
            visit(node.children);
        }
    };
    visit(nodes);
    return flat;
};
