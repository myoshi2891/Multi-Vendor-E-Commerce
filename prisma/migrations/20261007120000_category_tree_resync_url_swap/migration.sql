-- カテゴリツリー: url 交換を正しく追随する再同期（067 の補正・plan 082）
--
-- 067（`_category_tree_phase_b_resync`）の再同期は、2 ノードが url を交換した場合に
-- 片側を誤って寄せる。先に処理される側は「相手がまだ旧 url を保持している」ために
-- 衝突と判定され、`<親slug>-<旧slug>` へ不要に寄せられる（後から処理される側だけが
-- 希望の url を得る）。Category.url は UNIQUE なので、交換は必ず
-- 「一旦どかす → 入れ直す」の 2 段階が要る。
--
-- この対策は当初 067 本体へ追記された（`0ffb72b8`）が、067 は既に適用済みだったため
-- チェックサム不一致を招いた。適用済みマイグレーションは編集しない（tech.md 禁止事項）
-- ので、067 を元に戻し、補正として本マイグレーションを新設した。
--
-- **067 の誤りで既にずれた行もここで直る。** 一時退避の対象は
-- 「Category.url が SubCategory.url と食い違う行」なので、067 が寄せてしまった行
-- （`electronics-audio` 等）も退避され、直後のループが SubCategory 側の url へ揃える。
--
-- 別名（CategorySlugAlias）はここでは投入しない。SubCategory.url は本マイグレーションで
-- 変わらず、別名の投入規則（先着優先）は `_category_tree_alias_owner_preserve` が正である。
-- 以後の再同期は 067 の区間ではなく、本区間 + ALIAS_OWNER_PRESERVE の規則に従うこと。
--
-- マーカー区間は**再実行可能**であり、統合テストがここを読み出してそのまま実行する
-- （SQL の SSOT を 2 つにしないため）。DDL を区間に含めないこと。

-- >>> RESYNC_URL_SWAP >>>

-- 再同期対象（SubCategory 由来のノード）で url が変わる行を、実 slug と衝突し得ない
-- 一時 url へ先に退避する。一時 url は id を含むため一意で、直後のループが必ず
-- 最終 url を書き戻す。
UPDATE "Category" c
SET url = '__resync_tmp__' || c.id
FROM "SubCategory" s
WHERE c.id = s.id AND c.url IS DISTINCT FROM s.url;

-- 067 と同一の規則（衝突回避・属性同期）。
DO $RESYNC_URL_SWAP$
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
        ORDER BY s."createdAt" ASC, s.id ASC   -- 067 と同じ決定論性
    LOOP
        -- 自分自身は衝突相手から除く（除かないと 2 回目の実行で不要なリネームが走る）。
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
        -- sortOrder と childCount は Category 側が正なので上書きしない。
        ON CONFLICT (id) DO UPDATE SET
            name        = EXCLUDED.name,
            image       = EXCLUDED.image,
            url         = EXCLUDED.url,
            featured    = EXCLUDED.featured,
            "parentId"  = EXCLUDED."parentId",
            path        = EXCLUDED.path,
            depth       = EXCLUDED.depth,
            "updatedAt" = EXCLUDED."updatedAt";
    END LOOP;
END
$RESYNC_URL_SWAP$;

-- ループが親を付け替え得るため、067 と同じく全件再計算する。
UPDATE "Category" p
SET "childCount" = (SELECT count(*) FROM "Category" ch WHERE ch."parentId" = p.id);

-- <<< RESYNC_URL_SWAP <<<
