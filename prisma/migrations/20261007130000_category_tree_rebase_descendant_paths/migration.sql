-- カテゴリツリー: 再同期で path が変わったノードの子孫 path を付け替える（`_category_tree_resync_url_swap` の補正）
--
-- 再同期（067 / `_category_tree_resync_url_swap`）は SubCategory 由来の depth 1 ノードの
-- url と path を書き換えるが、その**子孫（depth 2 以上）の path は書き換えない**。
-- path は全サブツリー検索の prefix キーなので、取り残された子孫（商品を持たない中間ノード
-- 配下を含む）は祖先フィルタから静かに落ちる（`src/lib/category-path.ts` の `rebasePath` と同じ問題）。
--
-- `_category_tree_resync_url_swap` は適用済みで編集できない（tech.md 禁止事項）ため、
-- 補正として本マイグレーションを新設した。
-- 以後の再同期は `RESYNC_URL_SWAP` の直後に本区間を流すこと。
--
-- 規則: ルートから parentId を辿り、各ノードの path を「親の（付け替え後の）path +
-- 自分の現在の末尾セグメント」で作り直す。祖先の前置だけが置き換わり、子孫自身の
-- 相対 suffix は保たれる。変化の無い行は更新しないので、再実行しても結果は変わらない。
--
-- マーカー区間は**再実行可能**であり、統合テストがここを読み出してそのまま実行する
-- （SQL の SSOT を 2 つにしないため）。DDL を区間に含めないこと。

-- >>> REBASE_DESCENDANT_PATHS >>>

WITH RECURSIVE tree AS (
    SELECT c.id, c.path AS new_path
    FROM "Category" c
    WHERE c."parentId" IS NULL
    UNION ALL
    SELECT ch.id, t.new_path || '/' || regexp_replace(ch.path, '^.*/', '')
    FROM "Category" ch
    JOIN tree t ON ch."parentId" = t.id
)
UPDATE "Category" c
SET path = t.new_path
FROM tree t
WHERE c.id = t.id AND c.path IS DISTINCT FROM t.new_path;

-- <<< REBASE_DESCENDANT_PATHS <<<
