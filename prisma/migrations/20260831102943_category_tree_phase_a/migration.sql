-- カテゴリツリー Phase A（plan 066 / ADR-006 / docs/design/category-tree/design.md §3-§4）
--
-- 本マイグレーションは **加算のみ** で、既存の読み書き経路を一切変えない。
-- ロールバックは新列・新テーブルの drop で足りる（Phase C = plan 068 のみ不可逆）。
--
-- "path" は既存行のあるテーブルへの NOT NULL 追加なので
-- 「nullable で追加 → データ移行で backfill → SET NOT NULL」の 3 段に分けている。

-- CreateEnum
CREATE TYPE "CategoryAliasSource" AS ENUM ('CATEGORY', 'SUB_CATEGORY');

-- AlterTable（"path" はこの時点では nullable。末尾で NOT NULL に締める）
ALTER TABLE "Category" ADD COLUMN     "childCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "categoryNodeId" TEXT;

-- CreateTable
CREATE TABLE "CategorySlugAlias" (
    "entityType" "CategoryAliasSource" NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategorySlugAlias_pkey" PRIMARY KEY ("entityType","oldSlug")
);

-- CreateIndex
CREATE INDEX "CategorySlugAlias_categoryId_idx" ON "CategorySlugAlias"("categoryId");

-- CreateIndex
CREATE INDEX "Category_parentId_sortOrder_idx" ON "Category"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "Category_path_idx" ON "Category"("path");

-- CreateIndex
CREATE INDEX "Product_categoryNodeId_idx" ON "Product"("categoryNodeId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorySlugAlias" ADD CONSTRAINT "CategorySlugAlias_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryNodeId_fkey" FOREIGN KEY ("categoryNodeId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- >>> PHASE_A_DATA_MOVE >>>
-- ここから閉じマーカーまでは **何度実行しても同じ結果になる**（冪等）DML である。
-- 統合テストはこの区間だけを抜き出して 2 回実行し、冪等性（V-3）を実測する
-- （tests/integration/category-tree-migration.test.ts）。SQL の SSOT はこのファイル 1 つ。
-- マイグレーション自体は空 DB へ適用されるため、ここは通常 no-op で通過する。

-- A-1: 既存 Category をルート化する（path = url / depth = 0）
UPDATE "Category" SET "path" = "url", "depth" = 0 WHERE "parentId" IS NULL;

-- A-3: SubCategory を Category の子として取り込む。
--      SubCategory の id をそのまま新 Category 行の id に流用するので、
--      A-6 の backfill が単純な列コピーで済む（対応表を引く必要がない）。
DO $PHASE_A$
DECLARE
    r      RECORD;
    v_url  TEXT;
    v_base TEXT;
    v_n    INT;
BEGIN
    FOR r IN
        SELECT s.id, s.name, s.image, s.url, s.featured, s."categoryId",
               s."createdAt", s."updatedAt",
               p.url  AS parent_url,
               p.path AS parent_path
        FROM "SubCategory" s
        JOIN "Category" p ON p.id = s."categoryId"
        ORDER BY s."createdAt" ASC, s.id ASC   -- 決定論性（design.md §2-Q2-2 の 3.）
    LOOP
        -- 取り込み済みなら何もしない。これが冪等性の要（2 回目は全件 CONTINUE）。
        IF EXISTS (SELECT 1 FROM "Category" c WHERE c.id = r.id) THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM "Category" c WHERE c.url = r.url) THEN
            -- 衝突していない: 旧 slug をそのまま使う
            v_url := r.url;
        ELSE
            -- 衝突組は SubCategory 由来の側をリネームする（上位 URL を温存）。
            -- 新 slug = <親slug>-<旧slug>。さらに衝突する場合は -2, -3, … と
            -- 最初の空き番号を昇順で採用する（design.md §2-Q2-2 の 1.〜2.）。
            v_base := r.parent_url || '-' || r.url;
            v_url  := v_base;
            v_n    := 1;
            WHILE EXISTS (SELECT 1 FROM "Category" c WHERE c.url = v_url) LOOP
                v_n   := v_n + 1;
                v_url := v_base || '-' || v_n;
            END LOOP;
        END IF;

        INSERT INTO "Category" (
            id, name, image, url, featured, "parentId",
            "path", "depth", "sortOrder", "childCount", "createdAt", "updatedAt"
        )
        VALUES (
            r.id, r.name, r.image, v_url, r.featured, r."categoryId",
            r.parent_path || '/' || v_url, 1, 0, 0, r."createdAt", r."updatedAt"
        );
    END LOOP;
END
$PHASE_A$;

-- A-4: 旧 slug → ノードの対応表を投入する（upsert なので再実行しても同結果）。
--      キーが (entityType, oldSlug) なので、Category "camera" と SubCategory "camera" が
--      衝突していた場合でも 2 行が共存できる（design.md §2-Q2-3）。
INSERT INTO "CategorySlugAlias" ("entityType", "oldSlug", "categoryId")
SELECT 'SUB_CATEGORY', s.url, s.id FROM "SubCategory" s
ON CONFLICT ("entityType", "oldSlug") DO UPDATE SET "categoryId" = EXCLUDED."categoryId";

INSERT INTO "CategorySlugAlias" ("entityType", "oldSlug", "categoryId")
SELECT 'CATEGORY', c.url, c.id FROM "Category" c WHERE c."parentId" IS NULL
ON CONFLICT ("entityType", "oldSlug") DO UPDATE SET "categoryId" = EXCLUDED."categoryId";

-- A-5: childCount の初期化。差分更新ではなく全件再計算にしてあるので、
--      子が消えていた場合もドリフトが残らない（V-4 が検出する対象そのもの）。
UPDATE "Category" p
SET "childCount" = (SELECT count(*) FROM "Category" ch WHERE ch."parentId" = p.id);

-- A-6: Product の新 FK を backfill する（A-3 の id 流用によりそのまま入る）。
UPDATE "Product"
SET "categoryNodeId" = "subCategoryId"
WHERE "categoryNodeId" IS DISTINCT FROM "subCategoryId";
-- <<< PHASE_A_DATA_MOVE <<<

-- backfill 済みなので "path" を締める（Phase A の目標形は NOT NULL）
ALTER TABLE "Category" ALTER COLUMN "path" SET NOT NULL;
