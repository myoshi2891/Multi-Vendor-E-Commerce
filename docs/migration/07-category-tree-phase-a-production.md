# カテゴリツリー Phase A — 本番適用手順（ロックを最小化する）

- **対象マイグレーション**: `prisma/migrations/20260831102943_category_tree_phase_a/`
- **関連**: [ADR-006](../architecture/decisions/006-category-tree-representation.md) /
  [design.md §3-§4](../design/category-tree/design.md) /
  [plan 066](../../plans/066-implement-category-tree-schema.md)

---

## 1. なぜ本書が要るか

`prisma migrate deploy` は **マイグレーションファイル 1 本を 1 トランザクション**として流す。
Phase A のファイルはその前提で書かれており、**空 DB・開発 DB・CI・統合テストではこのまま正しい**。
本書は書き換えの提案ではなく、**行数の多い本番 `Product` に対してだけ必要になる別経路**である。

本番でそのまま流すと、次の 3 つが **1 つのトランザクションの中で** 起きる:

| 文 | 取るロック | 所要 |
|---|---|---|
| `CREATE INDEX "Product_categoryNodeId_idx"` | `Product` に `SHARE`（**書き込みを全面ブロック**） | 索引全体を構築する時間 |
| `ALTER TABLE "Product" ADD CONSTRAINT ... FOREIGN KEY` | `Product` と `Category` に `SHARE ROW EXCLUSIVE` | 既存全行の**検証スキャン** |
| `CREATE INDEX "Category_parentId_sortOrder_idx"` / `"Category_path_idx"` | `Category` に `SHARE` | `Category` は小さいので通常は一瞬 |

トランザクションなので、**最初に取ったロックは最後まで解放されない**。
`Product` の行数が増えるほど、この区間は「商品の書き込みが一切通らない時間」に等しくなる。

> **既存のマイグレーションファイルは編集しないこと。**
> [`.claude/steering/tech.md`](../../.claude/steering/tech.md) の禁止事項どおり、適用済み
> マイグレーションの改変は checksum のずれと環境間の不整合を生む。**本書は「同じ最終状態へ
> 別経路で到達し、マイグレーションを適用済みとして解決する」手順**である。

---

## 2. 適用要否の判定

```sql
-- Product が十分小さければ、素直に `prisma migrate deploy` でよい。
SELECT count(*) AS product_rows FROM "Product";
```

- **目安 10 万行未満**: 本書は不要。`bunx prisma migrate deploy` を通常どおり実行する。
- **それ以上、または書き込み停止の許容時間が読めない**: 以下の §3 を使う。

---

## 3. 手順（ロック最小化経路）

**接続はプールを経由しない直結**で行うこと。`CREATE INDEX CONCURRENTLY` は
**トランザクションブロック内で実行できない**ため、Prisma Accelerate / PgBouncer の
transaction モード経由では失敗する。`DIRECT_URL`（Neon の直結エンドポイント）を使う。

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f <各ステップのファイル>
```

### Step 0 — 移行前ベースラインの記録（ロールバック判定に使う）

**最初の DDL より前に**実行し、件数を控えておくこと。Step 5 は `SubCategory` 1 行につき
`Category` 行を 1 行増やすため、ロールバックで「複製行を消し切ったか」を判定できるのは
**この移行前の件数**だけである。Step 6 が測るのは `Product` の件数であって
`Category` の件数ではないので、ここで取らないとロールバック時に比較対象を失う。

```sql
SELECT count(*) AS category_rows_baseline FROM "Category";
```

### Step 1 — 加算のみ（1 トランザクション・一瞬）

```sql
BEGIN;

CREATE TYPE "CategoryAliasSource" AS ENUM ('CATEGORY', 'SUB_CATEGORY');

-- 既定値つきの列追加は PostgreSQL 11+ では**書き換えを伴わない**（カタログ更新のみ）。
ALTER TABLE "Category"
  ADD COLUMN "childCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "depth"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "parentId"   TEXT,
  ADD COLUMN "path"       TEXT,          -- NOT NULL は Step 5 で締める
  ADD COLUMN "sortOrder"  INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Product" ADD COLUMN "categoryNodeId" TEXT;

CREATE TABLE "CategorySlugAlias" (
    "entityType" "CategoryAliasSource" NOT NULL,
    "oldSlug"    TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategorySlugAlias_pkey" PRIMARY KEY ("entityType","oldSlug")
);
CREATE INDEX "CategorySlugAlias_categoryId_idx" ON "CategorySlugAlias"("categoryId");

COMMIT;
```

### Step 2 — 索引を CONCURRENTLY で（**トランザクション外**・1 文ずつ）

`BEGIN` を書かないこと。`psql` は既定で各文を自動コミットするので、1 文ずつそのまま流す。

```sql
CREATE INDEX CONCURRENTLY "Category_parentId_sortOrder_idx" ON "Category"("parentId", "sortOrder");
CREATE INDEX CONCURRENTLY "Category_path_idx"               ON "Category"("path");
CREATE INDEX CONCURRENTLY "Product_categoryNodeId_idx"      ON "Product"("categoryNodeId");
```

> **CONCURRENTLY は失敗すると INVALID な索引を残す**（自動では消えない）。
> プランナに使われないまま書き込みコストだけ増えるので、必ず検算する:
>
> ```sql
> SELECT c.relname, i.indisvalid
> FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
> WHERE c.relname IN ('Category_parentId_sortOrder_idx','Category_path_idx','Product_categoryNodeId_idx');
> ```
>
> `indisvalid = false` の行は `DROP INDEX CONCURRENTLY "<名前>";` してから再作成する。

### Step 3 — 外部キーを NOT VALID で追加（短時間ロック・検証スキャンなし）

`NOT VALID` は**既存行を検証しない**ため、`ALTER TABLE` は一瞬で返る。
以降の**新規・更新行はこの時点から検証される**（NOT VALID が緩めるのは既存行だけ）。

```sql
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "CategorySlugAlias" ADD CONSTRAINT "CategorySlugAlias_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryNodeId_fkey"
  FOREIGN KEY ("categoryNodeId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
```

### Step 4 — 検証を別手順で（`SHARE UPDATE EXCLUSIVE` のみ＝読み書きを止めない）

```sql
ALTER TABLE "Category"          VALIDATE CONSTRAINT "Category_parentId_fkey";
ALTER TABLE "CategorySlugAlias" VALIDATE CONSTRAINT "CategorySlugAlias_categoryId_fkey";
ALTER TABLE "Product"           VALIDATE CONSTRAINT "Product_categoryNodeId_fkey";
```

> **`Product` の VALIDATE は Step 5 の後に回してもよい。** Step 5 が
> `categoryNodeId` を全件埋めるため、先に流すと検証スキャンが 2 度走ることになる。
> 順序を入れ替える場合も、**Step 3 の NOT VALID 追加だけは Step 5 より前**に置くこと
> （新規行に FK が効いていない窓を作らないため）。

### Step 5 — データ移行 DML（マイグレーション本体の `PHASE_A_DATA_MOVE` 区間をそのまま）

**この区間は SQL の SSOT がマイグレーションファイル側にある。写経せず抜き出して流すこと**
（統合テストも同じ抜き出し方をしている: `tests/integration/setup/migration-sql.ts`）。

```bash
awk '/>>> PHASE_A_DATA_MOVE >>>/,/<<< PHASE_A_DATA_MOVE <<</' \
  prisma/migrations/20260831102943_category_tree_phase_a/migration.sql \
  > /tmp/phase-a-data-move.sql
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 --single-transaction -f /tmp/phase-a-data-move.sql
```

区間は冪等（V-3）なので、中断したら**そのまま再実行してよい**。

> **前提条件（`Category` / `SubCategory` の書き込み窓）。** §1 が止めないと約束しているのは
> **`Product` の書き込み**であって、**カテゴリ自体の編集ではない**。A-3 が走った後に
> 旧リビジョンの admin が
>
> - **`SubCategory` を新規作成する** と、その行には対応する `Category` の複製が作られず、
>   ツリーから**黙って欠落**する（A-3 は 1 度しか走らないため、後から自然には埋まらない）
> - **`Category` を新規作成する** と、旧コードは `path` / `depth` を書かないので
>   `path IS NULL` の行が生まれ、直下の `SET NOT NULL` が**失敗する**
>
> したがって **A-3 から Step 7 までの区間は、次のどちらかを満たすこと**:
>
> - **(a) `Category` / `SubCategory` への書き込みを止め、旧リビジョンを drain し切る**、または
> - **(b) 複製と別名（`Category` 行と `CategorySlugAlias`）を同時に書く dual-write ビルドを
>   デプロイし、旧リビジョンが完全に drain し切っている**
>
> `Product` 側と違い、こちらは**カテゴリ編集を止めれば足りる**（商品の書き込みは止まらない）ので、
> 通常は (a) が現実的である。中断して再開する場合は、**A-3 は冪等なので Step 5 を丸ごと
> 再実行してよい** —— 窓の間に生えた `SubCategory` はその再実行で取り込まれる。

`path` を締める前に、**窓の間に取り残しが生まれていないこと**を確認する:

```sql
-- (1) path が埋まっていない Category 行（旧リビジョンの書き込み残り）
SELECT count(*) AS categories_without_path FROM "Category" WHERE "path" IS NULL;

-- (2) 複製が作られていない SubCategory（A-3 の後に生えた行）
SELECT count(*) AS unmirrored_subcategories
  FROM "SubCategory" s
 WHERE NOT EXISTS (SELECT 1 FROM "Category" c WHERE c.id = s.id);
```

**両方が 0 でなければ先へ進まない。** 0 でない場合は上の前提条件が崩れている
（カテゴリ編集がまだ生きている）ので、書き込みを止めたうえで Step 5 を再実行し、
再度この 2 本を流して 0 を確認すること。`SET NOT NULL` は (1) が 0 でなければ
どのみち失敗するが、(2) は**失敗せず静かに欠落する**ため、この検査でしか捕まらない。

続けて `path` を締める:

```sql
ALTER TABLE "Category" ALTER COLUMN "path" SET NOT NULL;
```

> `SET NOT NULL` は既存行の全件スキャンを伴い、その間 `ACCESS EXCLUSIVE` を取る。
> `Category` は小さいので通常は問題にならない。

### Step 6 — STOP 条件の計測（ADR-006 の計測 3）

**A-6 の backfill 完了後**に実行する。`> 0` なら Phase B / C の前に経過措置の規模を判断する。

```sql
SELECT count(*) FROM "Product" p
JOIN "Category" c ON c.id = p."categoryNodeId"
WHERE c."childCount" > 0;
```

### Step 6.5 — 最終リコンサイル（解決の直前に必ず流す）

> **前提条件（Step 6.5 に入る前に必ず満たすこと）。** 次のどちらかが成立していること:
>
> - **(a) `Product` の書き込み経路を止めている**（旧リビジョンが 1 つも稼働していない）、または
> - **(b) `categoryNodeId` を `subCategoryId` と同時に書く dual-write ビルドをデプロイし、
>   旧リビジョンが完全に drain し切っている**（ローリングデプロイの残存インスタンス・
>   実行中のジョブ・キューの滞留分を含めてゼロ）
>
> **これが無いと下の UPDATE は勝てない。** 冪等な埋め直しが収束するのは「新しい
> `categoryNodeId IS NULL` 行がもう生まれない」場合だけであり、旧リビジョンが 1 つでも
> 書き続けている限り、UPDATE の直後・0 行確認と Step 7 の間・Step 7 の後にも
> NULL 行が生まれ続ける。**「0 行だった」は検査時点のスナップショットにすぎない。**
> (b) を採れば書き込みを止めずに済み、§1 の目的（`Product` の書き込みを止めない）とも両立する。
>
> dual-write のまま Step 6.5 → 検証 → Step 7 を通し切ること。旧リビジョンへ切り戻す
> ロールバックを行った場合は、この前提が崩れるので Step 6.5 からやり直す。

**本手順自体は書き込みを止めない。** 上の前提のもとでも、Step 5 の backfill から
dual-write ビルドが行き渡るまでの間に作られた行は `categoryNodeId IS NULL` の
まま残りうる。解決の直前にもう一度だけ埋め直す:

```sql
UPDATE "Product" SET "categoryNodeId" = "subCategoryId"
WHERE "categoryNodeId" IS DISTINCT FROM "subCategoryId";
```

Step 5 の A-6 と同一の冪等 UPDATE なので、何度流しても差分がゼロに収束する。
**ただしこの UPDATE が返す行数は「今まさに埋め直した取り残しの数」であって、
残存不一致の数ではない。** 初回はここが 0 にならないのが正常であり、この戻り値を
そのまま合格判定に使ってはならない。**必ず独立した検証を 1 回追加し、それが 0 を
返してから Step 7 へ進むこと**（どちらか一方でよい）:

```sql
-- (i) 不一致件数を直接数える（推奨: 判定と修正が分離される）
SELECT count(*) AS remaining
FROM "Product"
WHERE "categoryNodeId" IS DISTINCT FROM "subCategoryId";
-- → remaining = 0 を確認してから Step 7 へ

-- (ii) あるいは同じ UPDATE をもう一度流し、影響行数が 0 であることを確認する
UPDATE "Product" SET "categoryNodeId" = "subCategoryId"
WHERE "categoryNodeId" IS DISTINCT FROM "subCategoryId";
-- → UPDATE 0 を確認してから Step 7 へ
```

0 以外が返った場合は取り残しが残っている（= dual-write がまだ行き渡っていない）。
前提条件 (b) の成立を確認し直してから、埋め直しと検証を繰り返すこと。

> **なぜ「Step 1〜7 全体で書き込みを止める」ではなく再実行なのか。** 本書は §1 のとおり
> 「`Product` の書き込みを止めない」ことを目的に既定の 1 トランザクション経路から
> 分岐している。全区間にゲートを掛けると Step 1〜7 が丸ごと書き込み停止時間になり、
> 本書の存在意義そのものが消える。**書き込みを許すのは「新規行が正しい値を書く」区間に
> 限る**（= 上の前提条件 (b)）。その条件下でのみ、埋め直しの冪等性が
> **停止ではなく収束**として機能する。dual-write を用意できない場合は、
> 前提条件 (a) に従って Step 6.5 〜 Step 7 の区間だけ書き込みを止めること。

### Step 7 — マイグレーションを適用済みとして解決する

手で同じ最終状態を作ったので、マイグレーションランナーには**適用済み**と伝える。
これをやらないと次回の `migrate deploy` が同じファイルを流し、`CREATE TYPE` が
重複エラーで落ちる。

```bash
bunx prisma migrate resolve --applied 20260831102943_category_tree_phase_a
bunx prisma migrate status   # "Database schema is up to date!" を確認
```

---

## 4. ロールバック

Phase A は**加算のみ**なので、新列・新テーブル・新 FK を drop すれば戻る（不可逆なのは
Phase C = [plan 068](../../plans/068-implement-category-tree-admin-cutover.md) のみ）。

> **列を落とす前に、Step 5 が入れた複製 `Category` 行を消すこと。** Phase A は加算のみだが、
> それは*スキーマ*の話であって**データはそうではない** —— Step 5 は `SubCategory` 1 行につき
> 同じ id の `Category` 行を 1 行作る。列だけ drop すると、この複製行は
> 「`parentId` も `path` も持たないただのルートカテゴリ」として残り、
> **移行前には無かったカテゴリがストアフロントとダッシュボードに並ぶ**。
> 複製行は `SubCategory` と id を共有するが、**同定に使うのは現在の `SubCategory` 行ではなく
> A-4 の別名表（`CategorySlugAlias` の `entityType = 'SUB_CATEGORY'`）が保持する移行済み id**
> である。移行後に `SubCategory` が 1 行でも削除されていると、その複製 `Category` 行は
> join に掛からず残留し、参照検査もベースライン照合も取りこぼす。

```sql
-- 【STOP 判定】列を落とす前に、複製行を指している Product が無いことを確かめる。
-- 0 でなければ Phase B/C の書き込み経路がまだ生きている（= ロールバックの前提が
-- 崩れている）ので、ここで中断して報告すること。押し切ると商品のカテゴリ紐づけが
-- 失われる。**この検査は FK と列を落とす前にしか成立しない** —— 列を落とした後では
-- 参照そのものが消え、後段の DELETE は静かに通ってしまう。
--
-- 突き合わせ先は**現在の "SubCategory" 行ではない** —— 移行後に SubCategory が 1 行でも
-- 削除されていると、その複製 Category 行は join に掛からず、複製行を指したままの
-- Product を**見落とす**。Phase A が残した恒久マーカー（A-4 の別名表の
-- 'SUB_CATEGORY' 行 = 取り込んだ SubCategory の id）を使うこと。
-- 1 商品につき別名が複数あり得る（別名表の PK は (entityType, oldSlug)）ので、
-- join ではなく EXISTS で数える。数えるのは「複製行を指している Product の件数」。
SELECT count(*) AS products_on_mirror_rows
  FROM "Product" p
 WHERE EXISTS (
       SELECT 1
         FROM "CategorySlugAlias" a
        WHERE a."categoryId" = p."categoryNodeId"
          AND a."entityType" = 'SUB_CATEGORY');
-- ↑ が 0 であることを確認してから、以下を実行する。
-- 再実行時に別名表が既に落ちている場合は、突き合わせ先を "PhaseARollbackMirror" に
-- 読み替えること（下の破壊的ブロックが commit 済み = 別名表の内容は移し終えている）。

-- ここから先が破壊的処理。参照検査を通した**後**に、単一トランザクションへまとめる。
-- 途中で失敗しても部分適用が残らないため、同じブロックをそのまま再実行できる
-- （マーカー取得済み、または別名表が既に落ちている場合は INSERT を飛ばす）。
BEGIN;

ALTER TABLE "Product"  DROP CONSTRAINT IF EXISTS "Product_categoryNodeId_fkey";
ALTER TABLE "Product"  DROP COLUMN     IF EXISTS "categoryNodeId";

-- Step 5 が投入した複製行の id を、別名表を**消す前に**恒久マーカーへ書き出す。
-- A-4 の別名表は 'SUB_CATEGORY' 行の categoryId として「取り込んだ SubCategory の id」を
-- 保持しており（A-3 が id を流用するため両者は同一）、これが移行済み id の記録である。
CREATE TABLE IF NOT EXISTS "PhaseARollbackMirror" ("categoryId" TEXT PRIMARY KEY);
DO $$
BEGIN
    -- 再実行ガード: 既にマーカーを確保済み、または別名表が既に無い場合は何もしない。
    IF to_regclass('"CategorySlugAlias"') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "PhaseARollbackMirror") THEN
        INSERT INTO "PhaseARollbackMirror" ("categoryId")
        SELECT "categoryId" FROM "CategorySlugAlias" WHERE "entityType" = 'SUB_CATEGORY'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

DROP TABLE IF EXISTS "CategorySlugAlias";

-- Step 5 が投入した SubCategory 複製行を、上のマーカーを使って除去する。
-- **現在の "SubCategory" 行と突き合わせてはならない**（理由は上の参照検査と同じ）。
DELETE FROM "Category" c
 USING "PhaseARollbackMirror" m
 WHERE c.id = m."categoryId";

COMMIT;

-- 件数が Step 0 で控えた移行前のベースライン（category_rows_baseline）に
-- 戻ったことを確認してから次へ進む。**一致するまでマーカーは落とさない**
-- （不一致のときに何を消し損ねたかを引ける唯一の手掛かりであるため）。
SELECT count(*) AS category_rows FROM "Category";
```

> **⛔ STOP — ここで人間の確認が要る。**
> `category_rows` が Step 0 の `category_rows_baseline` と**一致することを目視で確認する**
> まで、次のブロックを実行してはならない。不一致は「複製行を消し損ねた」または
> 「消しすぎた」を意味し、次のブロックの `DROP COLUMN` / `DROP TYPE` は
> **元に戻せない**（`path` / `depth` / `parentId` の値はダンプからしか復元できない）。
>
> このため列削除は**別スクリプトとして分けてある**。`psql -f` で上のブロックと
> 続けて流さないこと —— 1 ファイルにまとめると、検証 SELECT の結果を誰も見ないまま
> 破壊的 DDL まで到達する経路ができる。

一致を確認できたら、次のブロックを**別途**実行する:

```sql
ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_parentId_fkey";
ALTER TABLE "Category" DROP COLUMN IF EXISTS "parentId",
                       DROP COLUMN IF EXISTS "path",
                       DROP COLUMN IF EXISTS "depth",
                       DROP COLUMN IF EXISTS "childCount",
                       DROP COLUMN IF EXISTS "sortOrder";
DROP TYPE IF EXISTS "CategoryAliasSource";
```

`category_rows` が `category_rows_baseline` と一致したことを確認できたら、
最後にマーカーを片付ける（一致するまでは残しておくこと）:

```sql
DROP TABLE IF EXISTS "PhaseARollbackMirror";
```

> 上の `products_on_mirror_rows` が 0 でない場合は、**まだ Phase B/C の書き込み経路が
> 生きている**（`categoryNodeId` が複製行を指したまま）ことを意味する。ロールバックの
> 前提が崩れているので STOP して報告すること。
>
> かつてこの注記は「`DELETE` が `Product` の FK で止まったら STOP」と書いていたが、
> **その時点では FK も列も既に落ちている**ため、この検知は原理的に発火しない。
> 判定は上記のとおり drop の**前**に置くこと。

その後 `bunx prisma migrate resolve --rolled-back 20260831102943_category_tree_phase_a`。

---

## 5. Phase B の再同期にも同じ判断が要る

[plan 067](../../plans/067-implement-category-tree-queries.md) の
`20260901223148_category_tree_phase_b_resync` は DML のみ（DDL なし）だが、
最後の `UPDATE "Product" SET "categoryNodeId" = "subCategoryId"` は
**行数分の行ロック**を取る。差分だけを更新する `WHERE categoryNodeId IS DISTINCT FROM
subCategoryId` が付いているので通常は軽いが、初回適用時は全行が対象になりうる。
長いトランザクションを避けたい場合は id 範囲でバッチ分割する（区間は冪等なので分割してよい）。
