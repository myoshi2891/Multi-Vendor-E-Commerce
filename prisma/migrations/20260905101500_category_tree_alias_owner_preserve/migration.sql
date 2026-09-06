-- カテゴリツリー: SUB_CATEGORY 別名の所有者を先着で固定する（067 の補正）
--
-- 067（`_category_tree_phase_b_resync`）の A-4 相当の投入は
-- `ON CONFLICT ("entityType", "oldSlug") DO UPDATE SET "categoryId" = EXCLUDED."categoryId"`
-- で書かれており、**旧 slug が別ノードに再利用されると別名の所有者が奪われる**。
--
-- なぜ SUB_CATEGORY で害になるか（CATEGORY では起きない）:
-- `resolveCategoryNode`（`src/lib/category-tree.ts`）の解決順序は entityType で非対称で、
-- `SUB_CATEGORY` は **別名表 → `Category.url`** の順に引く（design.md §2-Q3）。
-- よって `(SUB_CATEGORY, X)` の所有者が後から X を正準 slug にしたノードへ書き換わると、
-- 「X という旧 slug を持っていたノード」宛の生きた `?subCategory=X` リンクが、
-- **黙って別サブツリーへ 308 される**。`CATEGORY` は `Category.url` を先に引くため、
-- 再利用された正準 slug が勝ち、同じ経路は生じない。
--
-- 先着優先はアプリ側の書き込み経路（`src/queries/category.ts` の別名作成が
-- `createMany({ skipDuplicates: true })`）で既に採っている規則であり、
-- 移行側だけがこれと矛盾していた。以後の再同期はこの区間の規則に従うこと。
--
-- **既に奪われた所有権は復元できない**（元の所有者は現在のデータから導出できない）。
-- 本マイグレーションが行うのは (1) 欠けている別名行の先着投入と
-- (2) 以後の再同期が写すべき規則の固定であって、過去の上書きの巻き戻しではない。
--
-- マーカー区間は**再実行可能**であり、統合テストがここを読み出してそのまま実行する
-- （SQL の SSOT を 2 つにしないため）。DDL を区間に含めないこと。

-- >>> ALIAS_OWNER_PRESERVE >>>

-- 先着を残す。既存行があれば `categoryId` は触らない。
INSERT INTO "CategorySlugAlias" ("entityType", "oldSlug", "categoryId")
SELECT 'SUB_CATEGORY', s.url, s.id FROM "SubCategory" s
ON CONFLICT ("entityType", "oldSlug") DO NOTHING;

-- <<< ALIAS_OWNER_PRESERVE <<<
