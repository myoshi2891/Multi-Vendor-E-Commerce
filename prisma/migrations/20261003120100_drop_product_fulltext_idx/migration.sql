-- plan 074 Step 4 / ADR-008 D-4: 旧い式インデックスを削除する。
-- 検索はすべて "searchVector"（Product_searchVector_idx）へ移行済みで、
-- to_tsvector('simple', name || ' ' || COALESCE(description, '')) の式を使うクエリは残っていない。
-- 2 本の GIN を同時に保守しない（書き込みコストの二重払いを避ける）。
DROP INDEX IF EXISTS "Product_fulltext_idx";
