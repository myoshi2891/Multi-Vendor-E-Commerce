/**
 * カテゴリツリー（materialized path）の**純粋な**ヘルパー。
 *
 * DB に触れないものだけをここに置く。`"use client"` のフォームからも
 * import されるため、**このモジュールが `@/lib/db` に依存してはならない**
 * （依存させると Prisma クライアントがクライアントバンドルへ引きずり込まれる）。
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

/**
 * カテゴリツリーの最大 depth（ルート = 0 なので 5 階層）。
 *
 * ADR-006 / design.md V-7 の決定。`Category.depth` のコメントと同じ値であり、
 * **書き込み側の検証はこの定数だけを見る**（マジックナンバーを散らさない）。
 */
export const MAX_CATEGORY_DEPTH = 4;

/**
 * Derive the depth of a materialized path.
 *
 * `path` は区切り文字を末尾に付けない約束（`subtreeOf` と同じ前提）なので、
 * セグメント数 - 1 が depth になる。
 *
 * @param path - 対象ノードの `Category.path`
 * @returns ルートを 0 とする深さ
 */
export const depthOfPath = (path: string): number => path.split("/").length - 1;

/**
 * Rebase a descendant path from one ancestor path onto another.
 *
 * materialized path は祖先を値として抱えているため、**親を替えたノードの `path`
 * だけを更新すると子孫が旧祖先を指したまま取り残される**。`subtreeOf`（前置一致）で
 * 回る検索・ファセット・admin ツリーはすべて `path` を正とするので、取り残しは
 * 「商品が消えた」という形でしか表面化しない静かな破損になる。
 *
 * **呼び出し前に `isWithinSubtree(path, oldAncestorPath)` が真であることを確認すること。**
 * 前置一致しない path を渡すと、セグメント境界を無視した文字列結合になる。
 *
 * @param path - 書き換え対象の子孫 path
 * @param oldAncestorPath - 移動前の祖先 path
 * @param newAncestorPath - 移動後の祖先 path
 * @returns 新しい祖先を前置に持つ path
 */
export const rebasePath = (
    path: string,
    oldAncestorPath: string,
    newAncestorPath: string
): string => `${newAncestorPath}${path.slice(oldAncestorPath.length)}`;

/**
 * Coerce an arbitrary string into the canonical category slug form.
 *
 * plan 066 の移行は既存 `url` を書き換えずに温存する（旧 slug を
 * `CategorySlugAlias` に記録するだけ）ため、大文字・`_`・空白を含む url が現存し得る。
 * それらは `CategoryFormSchema` の `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` を通らず、
 * **その行の編集（featured の切り替え等）ごと保存できない**。フォームの初期値を
 * ここで正準形へ寄せることで、旧データも編集可能になる。
 *
 * 区切り文字 `/` と LIKE のメタ文字（`%` `_`）が落ちるのは偶然ではない ——
 * slug は `Category.path` のセグメントになるため、これらが残ると `subtreeOf` の
 * `startsWith` がエスケープを必要とする（design.md §2-Q1）。
 *
 * @param raw - 正規化前の slug
 * @returns 正準形の slug。英数字を 1 文字も含まない場合は空文字（呼び出し側が
 *          「正規化できなかった」ことを検出できるようにする。`-` のような不正な
 *          slug を黙って作らない）
 */
export const toCanonicalCategorySlug = (raw: string): string =>
    raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
