-- カテゴリツリー Phase B: 読み取り切替の前提となる再同期（plan 067）
--
-- 066 の backfill は一度きりで、Phase A の書き込み経路は categoryNodeId を一切書かない。
-- したがって 066 適用後に作成・カテゴリ変更された商品は categoryNodeId が NULL / 旧値の
-- まま残る。読み取りを新 FK へ切り替える前に、この差分を必ず埋める必要がある。
--
-- **新規行の追加だけでは足りない。** 066 適用後には「SubCategory の rename」
-- 「親 Category の付け替え」「featured 等の表示属性の変更」も起きており、
-- WHERE NOT EXISTS の INSERT はそれらを一切拾わない。stale な path を残したまま
-- 読み取りを切り替えると、その枝の商品が祖先フィルタから静かに落ちる
-- （path は全サブツリー検索の prefix キーであるため）。よって再同期は A-3 と同じ規則で
-- **新規行と既存行の双方に適用する**。
--
-- マーカーで囲まれた区間は**再実行可能**であり、統合テストがここを読み出して
-- そのまま実行する（SQL の SSOT を 2 つにしないため）。DDL を区間に含めないこと。

-- >>> PHASE_B_RESYNC >>>

-- **swap 対策の一時退避（2 段階リネーム）。** a と b が url を交換した場合、
-- 先に処理される側は「相手がまだ旧 url を保持している」ために衝突と判定され、
-- `<親slug>-<旧slug>` へ不要に寄せられてしまう（後から処理される側だけが希望の
-- url を得る）。Category.url は UNIQUE なので、交換は必ず「一旦どかす → 入れ直す」の
-- 2 段階が要る。再同期対象（SubCategory 由来のノード）で url が変わる行を、
-- 実 slug と衝突し得ない一時 url へ先に退避しておく。
-- 一時 url は id を含むため一意で、直後のループが必ず最終 url を書き戻す。
UPDATE "Category" c
SET url = '__resync_tmp__' || c.id
FROM "SubCategory" s
WHERE c.id = s.id AND c.url IS DISTINCT FROM s.url;

-- 066 の A-3 と同一の規則（衝突回避・属性同期）を新規行と既存行の双方へ適用する。
DO $PHASE_B$
DECLARE
    r      RECORD;
    v_url  TEXT;
    v_base TEXT;
    v_n    INT;
BEGIN
    FOR r IN
        SELECT s.id, s.name, s.image, s.url, s.featured, s."categoryId",
               s."createdAt", s."updatedAt",
               p.url AS parent_url, p.path AS parent_path
        FROM "SubCategory" s JOIN "Category" p ON p.id = s."categoryId"
        ORDER BY s."createdAt" ASC, s.id ASC   -- A-3 と同じ決定論性
    LOOP
        -- slug 候補の決定。既存行の再計算では**自分自身を衝突相手から除く**
        -- （除かないと、2 回目の実行で自分の url に衝突して不要なリネームが走る）。
        IF NOT EXISTS (SELECT 1 FROM "Category" c
                        WHERE c.url = r.url AND c.id <> r.id) THEN
            v_url := r.url;
        ELSE
            v_base := r.parent_url || '-' || r.url;
            v_url  := v_base;
            v_n    := 1;
            WHILE EXISTS (SELECT 1 FROM "Category" c
                           WHERE c.url = v_url AND c.id <> r.id) LOOP
                v_n   := v_n + 1;
                v_url := v_base || '-' || v_n;
            END LOOP;
        END IF;

        INSERT INTO "Category" (id, name, image, url, featured, "parentId",
                                path, depth, "sortOrder", "childCount",
                                "createdAt", "updatedAt")
        VALUES (r.id, r.name, r.image, v_url, r.featured, r."categoryId",
                r.parent_path || '/' || v_url, 1, 0, 0,
                r."createdAt", r."updatedAt")
        -- 既存行は rename / 親付け替え / 表示属性の変更を追随させる。
        -- sortOrder と childCount は Category 側が正なので上書きしない
        -- （sortOrder は admin の並び替え結果、childCount は下で全件再計算する）。
        ON CONFLICT (id) DO UPDATE SET
            name        = EXCLUDED.name,
            image       = EXCLUDED.image,
            url         = EXCLUDED.url,
            featured    = EXCLUDED.featured,
            "parentId"  = EXCLUDED."parentId",
            path        = EXCLUDED.path,     -- 親変更・rename の両方を反映
            depth       = EXCLUDED.depth,
            "updatedAt" = EXCLUDED."updatedAt";
    END LOOP;
END
$PHASE_B$;

-- A-4 と同一の冪等エイリアス投入。rename 後も**旧 slug の行は消さない**ので
-- 旧 URL の 308 到達性（V-2）が保たれる。
INSERT INTO "CategorySlugAlias" ("entityType", "oldSlug", "categoryId")
SELECT 'SUB_CATEGORY', s.url, s.id FROM "SubCategory" s
ON CONFLICT ("entityType", "oldSlug") DO UPDATE SET "categoryId" = EXCLUDED."categoryId";

INSERT INTO "CategorySlugAlias" ("entityType", "oldSlug", "categoryId")
SELECT 'CATEGORY', c.url, c.id FROM "Category" c WHERE c."parentId" IS NULL
ON CONFLICT ("entityType", "oldSlug") DO UPDATE SET "categoryId" = EXCLUDED."categoryId";

-- A-5 と同一（親付け替えで両側の childCount が動くため全件再計算する）
UPDATE "Category" p
SET "childCount" = (SELECT count(*) FROM "Category" ch WHERE ch."parentId" = p.id);

-- 066 の A-6 と同一の冪等 UPDATE。IS DISTINCT FROM なので NULL も拾う。
UPDATE "Product" SET "categoryNodeId" = "subCategoryId"
WHERE "categoryNodeId" IS DISTINCT FROM "subCategoryId";

-- <<< PHASE_B_RESYNC <<<
