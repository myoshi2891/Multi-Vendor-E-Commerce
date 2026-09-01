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
