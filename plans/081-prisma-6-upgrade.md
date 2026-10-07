# Plan 081: Prisma 5.22 → 6.x へ上げる（段階移行の第 1 段）

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat 5babe124 -- package.json bun.lock prisma/schema.prisma prisma/migrations/ src/lib/db.ts
> git status --porcelain -- package.json bun.lock prisma/ src/lib/db.ts
> ```
> 差分があれば「Current state」の抜粋と突き合わせ、食い違えば STOP。

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED（本番に適用するマイグレーションが 1 本生まれる。生成列の宣言が新しい Prisma でドリフト扱いになる恐れがある）
- **Depends on**: —
- **Category**: dependencies
- **Planned at**: commit `5babe124`, 2026-10-06

## Why this matters

`prisma` の CLI が「5.22.0 → 8.0.0-rc.20」の更新を通知した。npm の dist-tag は
`latest: 8.0.0-rc.20` / `prev: 7.10.0` で、**8 は正式版ではない**（rc が `latest` に付いている）。
メジャーを 3 つ一度に越えると、どの段で壊れたか切り分けられない。そこで
**5 → 6 → 7 の段階移行**とし、8 は GA を待って判断する。本プランは第 1 段（5 → 6）。
6 系の最新は `6.19.3`（2026-10-06 に `npm view prisma@6 version` で確認）。

## Current state

- `package.json:26` `"@prisma/client": "5.22.0"`、`:27` `"@prisma/extension-accelerate": "^1.2.0"`、`:140` `"prisma": "5.22.0"`（いずれもピン留め）
- `prisma/schema.prisma:3` `previewFeatures = ["fullTextSearch"]`。商品検索・ブラウズの全文検索は `"searchVector"` に対する生 SQL（ADR-008）だが、
  **`src/app/api/index-products/route.ts` が Prisma の `search:` フィルタを使っている**（起票時は見落とし、実施時に判明）
- 暗黙の多対多は 2 つ: `User.following ↔ Store.followers`（`_UserFollowingStore`）と `User.coupons ↔ Coupon`（`_CouponToUser`）。
  `prisma/migrations/20260222101357_init_postgresql/migration.sql:625, 631` で `CREATE UNIQUE INDEX "_..._AB_unique"` として作られている
- `prisma/schema.prisma:222` `searchVector Unsupported("tsvector")? @default(dbgenerated("<pg_get_expr の生成式>"))` と `:229` `@@index([searchVector], type: Gin)`。
  **Prisma 5.22 が実 DB から読み取る形をそのまま宣言して** `migrate diff --exit-code` を exit 0 にしている（[ADR-008](../docs/architecture/decisions/008-product-search-vector.md) D-5、plan 074 の実施結果）
- `src/lib/db.ts` — `new PrismaClient().$extends(withAccelerate())` を Proxy で遅延生成する（CI の stub `DATABASE_URL` で build を通すため）
- `@prisma/extension-accelerate` の peerDependencies は `@prisma/client >=4.16.1`（最新は 3.0.1）
- `NotFoundError` / `$use`（v6 で削除）の使用は 0 件
- 影響範囲: `@prisma/client` を参照するファイル 175、生 SQL を含むファイル 23、db をモックする Jest ファイル 38

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| ドリフト判定 | `bunx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code` | exit 0（差分なし） |
| Generate | `bunx prisma generate` | エラーなし |
| Migrate | `bunx prisma migrate dev --create-only --name prisma6_implicit_m2m_pk` | マイグレーションが 1 本生成される（適用はしない） |
| ERD | `bun run erd:generate` | orphan WARNING 0 |
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | 0 errors |
| Unit | `bun run test` | 着手前の実測と同じ件数で all pass |
| Integration | `bun run test:integration` | 着手前の実測と同じ件数で all pass（Docker 必須） |
| Build | `DATABASE_URL=postgresql://stub:stub@localhost:5432/stub bun run build` | 成功（CI と同条件） |

`SHADOW_DATABASE_URL` はローカル Docker の DB 上に作る使い捨ての DB を指す（例: `postgresql://dev:<password>@localhost:5432/shadow_081`。
パスワードは `.env` / `docker-compose.yml` の値を使い、プランやコミットには書かない）。

## Scope

**In scope**:
- `package.json` / `bun.lock`（`prisma` / `@prisma/client` を 6 系に。Accelerate 拡張は互換が無い場合のみ更新）
- `prisma/schema.prisma`（`previewFeatures` の `fullTextSearch` → `fullTextSearchPostgres` への改名。生成式の文字列が変わる場合は D-5 の方針で追従）
- `prisma/migrations/<新規>/migration.sql`（暗黙の多対多 2 テーブルの主キー化）
- `docs/architecture/data-model.drawio`（再生成。[規約 03](../.claude/rules/03-data-model-diagram-sync.md) によりスキーマ変更と同じコミット）
- 型・テストの追従（tsc / Jest で差分が出た場合のみ）
- `plans/README.md`（Status 行）

**Out of scope**:
- 6 → 7（別プラン 082。末尾に概要）と 8
- `prisma.config.ts` の導入、接続アダプター、新しい generator（いずれも 7 の範囲）
- 本番 DB への `migrate deploy`（オペレーターが行う）

## Steps

### Step 0: 着手前の実測と公式情報の確認

1. `bun run test` と `bun run test:integration` を実行し、スイート数・テスト数を本プランの「実施結果」に記録する（受け入れ条件の基準値）
2. 公式の v6 アップグレードガイドを読み、上の「Current state」以外に該当する破壊的変更が無いか確認する
   （`Buffer` → `Uint8Array`、`NotFoundError` の削除、予約語になったモデル名など）
3. `@prisma/extension-accelerate` の現行版（`^1.2.0`）が 6 系で動くかを、互換表または changelog で確認する

**Verify**: 実測値が記録されている。該当する破壊的変更があれば、このプランの Scope に追記してから進む

### Step 1: 依存を上げる

```bash
bun add -d prisma@6
bun add @prisma/client@6
# Step 0-3 で非互換と分かった場合のみ
bun add @prisma/extension-accelerate@<対応版>
bunx prisma generate
```

`package.json` はピン留めの書式（`"6.19.3"` のような完全一致）を保つ。

**Verify**: `bunx prisma --version` が 6.x、`bunx prisma generate` が成功する

### Step 2: previewFeatures を改名する

`fullTextSearch` は PostgreSQL では `fullTextSearchPostgres` に改名された。`index-products` route が `search:` フィルタを使うため、
削除ではなく**改名**する（削除すると型エラーになり、route が動かなくなる）。

**Verify**: `bunx prisma validate` と `bunx prisma generate` が成功する

### Step 3: マイグレーションを作る（`safe-migration` スキル）

[`safe-migration`](../.claude/skills/safe-migration/SKILL.md) スキルの手順で `--create-only` を実行し、生成された SQL を読む。

期待する内容は 2 テーブル × 2 文だけ:

```sql
ALTER TABLE "_CouponToUser" ADD CONSTRAINT "_CouponToUser_AB_pkey" PRIMARY KEY ("A", "B");
DROP INDEX "_CouponToUser_AB_unique";
-- _UserFollowingStore も同様
```

**`searchVector` の生成式や `Product_searchVector_idx` に触れる文が混ざっていたら STOP**（下記）。
確認後に `bunx prisma migrate dev` で適用する（`db push` は使わない）。

**Verify**: 新規マイグレーションが 1 本だけ増え、中身が上の 4 文だけ

### Step 4: ドリフト判定（ゲート）

使い捨ての shadow DB を作り（`docker compose exec db createdb -U dev shadow_081`）、「Commands」のドリフト判定を実行する。
続けて `--from-schema-datasource prisma/schema.prisma`（適用後のローカル DB との比較）でも exit 0 を確認する。終わったら `dropdb shadow_081`。

**Verify**: どちらも exit 0。exit 2 なら STOP

### Step 5: ER 図を再生成する

```bash
bun run erd:generate
```

**Verify**: stderr の orphan WARNING が 0 件。`data-model.drawio` の差分が説明できる範囲（多対多の表現か、差分なし）

### Step 6: 型・テスト・ビルドを通す

「Commands」の Typecheck / Lint / Unit / Integration / Build を順に実行する。
型の再生成で差分が出た箇所だけを直す（投機的なリファクタはしない）。

**Verify**: すべて期待どおり。テスト件数が Step 0 の実測と一致する

### Step 7: E2E と通し適用

1. 使い捨ての DB に、`bunx prisma migrate deploy` で全マイグレーションを最初から適用できることを確認する
2. `bun run seed:e2e` のあと、Chromium で次の spec を実行する:
   `tests/e2e/purchase-flow.spec.ts`（購入）、`tests/e2e/search-filter.spec.ts`（検索 = `searchVector`）、
   `tests/e2e/engagement.spec.ts`（フォロー = `_UserFollowingStore`）、`tests/e2e/platform-coupon.spec.ts`（クーポン）
3. `_CouponToUser` と `_UserFollowingStore` の両方を書き換える経路は `tests/integration/user-deletion-webhook.test.ts` が通っていることで確認する（Step 6 に含まれる）

**Verify**: 通し適用が成功し、4 spec が pass する（既知の失敗 OI-13 / OI-14 / E2E-AUTH に該当するものは、HEAD でも同じく失敗することを確認して区別する）

## Test plan

- 新しいテストは書かない（振る舞いを変えない依存更新のため）。回帰の検出は既存の Unit / Integration / E2E と件数一致で行う
- 多対多の主キー化は、統合テスト（`user-deletion-webhook`）と E2E（`engagement`）で読み書きの両方を通す
- 件数が変わった場合のみ `spec-sync-after-test` を実行する

## Done criteria

- [x] `prisma` / `@prisma/client` が 6.x にピン留めされている
- [x] `previewFeatures` が `fullTextSearchPostgres` に改名されている
- [x] 新規マイグレーションが 1 本（多対多 2 テーブルの主キー化のみ）
- [x] Step 4 のドリフト判定が 2 つとも exit 0
- [x] `bun run erd:generate` を実行（図の差分なし。差分が出た場合はスキーマ変更と同じコミットに含める）
- [x] tsc exit 0 / lint 0 errors / Unit・Integration の件数が着手前と一致 / stub `DATABASE_URL` で build 成功
- [x] 使い捨て DB への `migrate deploy` の通し適用が成功（Integration の testcontainers）
- [ ] PR #194 の本文で本番オペレーターに「`bunx prisma migrate deploy` で多対多の主キー化マイグレーション 1 本を適用すること」を指示する（2026-10-07 時点で未記載。追記するまで未完了のまま）
- [x] `plans/README.md` の 081 の行を更新し、Next Actions の DEP-PRISMA6 を `render-html.ts` と `QA_HANDOFF.md` の両方から削除

## STOP conditions

- 生成されたマイグレーションに `searchVector` / `Product_searchVector_idx` / 他のテーブルへの変更が含まれる。
  Prisma 6 の生成式の読み取り方が変わった可能性がある。差分を添えて報告し、D-5 の宣言を更新するか
  （ADR-008 の改訂）、Option B へ切り替えるかを人間が判断する
- Step 4 のドリフト判定が exit 2
- Accelerate 拡張が 6 系に対応しない、または対応版が `src/lib/db.ts` の遅延生成（Proxy）を壊す
- stub の `DATABASE_URL` で build が失敗する（`db.ts` の遅延生成が効いていない）
- テスト件数が着手前と食い違い、理由を説明できない
- 既存のマイグレーションファイルを編集したくなった（禁止。補正用に新規作成する）

## コミット分割

1. `chore(deps): upgrade prisma to 6.x` — `package.json` / `bun.lock`、`schema.prisma`、新規マイグレーション、`data-model.drawio`
2. `fix(...)`/`test(...)` — 型・テストの追従（必要な場合のみ）
3. `docs: ...` — テスト件数などの文書同期（件数が変わった場合のみ `spec-sync-after-test`）と Next Actions の削除

## デプロイとロールバック

- **デプロイ**: 本番で `bunx prisma migrate deploy` による主キー化 1 本の適用が必要。適用はオペレーターが行う。
  `ADD PRIMARY KEY` は対象テーブルに `ACCESS EXCLUSIVE` を取るが、2 テーブルとも行数が少ない想定。
  適用前に `SELECT count(*)` で行数を確認し、重複行（主キー化が失敗する原因）が 0 であることを確かめる
  （既存の UNIQUE インデックスがあるため通常は 0）
- **ロールバック**: コミット 1 のリバートで依存とスキーマを戻す。DB を戻す場合は補正マイグレーション
  （`DROP CONSTRAINT "..._AB_pkey"` + `CREATE UNIQUE INDEX "..._AB_unique"`）を新規に作る。
  主キー化したままでも 5.22 のクライアントは動くため、DB の巻き戻しは必須ではない

## 第 2 段（6 → 7）の概要 — 別プラン 082 で詳細化する

- 接続 URL を `schema.prisma` の `datasource` から `prisma.config.ts` へ移す
- 接続アダプター（`@prisma/adapter-pg` など）の導入と、Accelerate（`withAccelerate()`）との組み合わせ方
- 新しい generator（`prisma-client`）と `output` の明示。import パスの変更が 175 ファイルに波及するかを確認する
- `.env` の自動読み込みが無くなる点の扱い（CLI・seed・Jest・Docker）
- Jest と bun のモジュール解決（ESM の生成クライアント）
- 8 は GA を待って判断する

## 実施結果（2026-10-06・未コミット）

- **着手前の実測**: Unit 302 スイート（1 skip）/ 2,922 件（3 skip）/ スナップショット 127、Integration 17 スイート / 222 件
- **依存**: `prisma` / `@prisma/client` を `6.19.3`（完全一致）へ。`@prisma/extension-accelerate ^1.2.0` は据え置き（generate / tsc / build で問題なし）。
  v6 ガイドの他の破壊的変更（`Bytes` の `Uint8Array` 化・`NotFoundError` 削除・予約語 `async`/`await`/`using`）は該当 0 件。Node v22.23 / TS 5.8.3 は要件を満たす
- **previewFeatures**: 起票時の「`search:` は未使用」は誤り。`src/app/api/index-products/route.ts` が使っているため、削除ではなく `fullTextSearchPostgres` へ改名した
- **マイグレーション**: `20261006120000_modify_implicit_m2m_pk`。中身は想定どおり `_CouponToUser` / `_UserFollowingStore` の `ADD CONSTRAINT ..._AB_pkey PRIMARY KEY ("A", "B")` + `DROP INDEX ..._AB_unique` の 4 文のみで、`searchVector` には触れない。
  - ローカル DB では `migrate dev` が使えなかった: `20260901223148_category_tree_phase_b_resync` が適用（2026-09-02）後に `0ffb72b8`（2026-09-05）で編集されており、チェックサムの不一致でリセット（全データ削除）を要求されるため。Prisma 6 とは無関係の既存の状態。
    代わりに使い捨ての shadow DB で `migrate diff --from-migrations ... --to-schema-datamodel ... --script` から SQL を生成し、ローカル DB へは `migrate deploy`（チェックサムを検査しない。本番と同じ経路）で適用した
- **ドリフト判定**: `--from-migrations`（新規分を含む）↔ スキーマ、適用後のローカル DB ↔ スキーマの両方が **exit 0**。ADR-008 D-5 の `dbgenerated` 宣言は Prisma 6 でもドリフト扱いにならない
- **ER 図**: `bun run erd:generate` で orphan WARNING 0、`data-model.drawio` の差分なし（モデル・リレーションは不変）
- **追従修正 1 件**: Integration（`testEnvironment: "jsdom"`）で `disconnectTestDb()` が `ReferenceError: setImmediate is not defined` で落ちた。
  Prisma 6 の LibraryEngine は `$disconnect()` の内部で `setImmediate` を使い、jest-environment-jsdom はそれを global から外すため。
  `tests-setup/jest.setup.ts` で未定義のときだけ Node の `timers` から補う（node 環境では何もしない）
- **検証**: tsc exit 0 / lint 0 errors（警告 8 件は既存）/ Unit・Integration ともに件数が着手前と一致 / stub `DATABASE_URL` で `bun run build` 成功。
  Integration は testcontainers の空 DB に 24 本を `migrate deploy` で通し適用するため、Step 7-1 もこれで確認済み
- **E2E（Chromium・`test:e2e:local`）**: 9 passed / 7 failed。失敗は `purchase-flow` 5 件（「Product added to cart」のトーストが出ない）、
  `engagement` のフォロー 1 件（`Follow` ボタンが見つからない）、`platform-coupon` 1 件。
  **HEAD（Prisma 5.22）の worktree でも同じ 7 件が同じロケーターで失敗**するため、既存の失敗で本アップグレードの回帰ではない。`search-filter` は全件 pass
  （2026-10-07 追記: 原因はデザイン移行 `d3e87f64` で文言・構造が変わったのに E2E が追従していなかったこと。[plan 082](082-fix-stale-e2e-selectors-and-migration-edit.md) で修正。ローカル DB で `migrate dev` が使えなかった件も plan 082 で解消）
- **本番**: Neon への `migrate deploy`（本マイグレーション 1 本）はオペレーターが行う。適用前に 2 テーブルの重複行が 0 であることを確認する（既存の UNIQUE インデックスがあるため通常は 0）
