# 保留3件（DS-SELLER-REAUDIT-ROUTES / DS-PAGE-022 / DS-PAGE-004）の実環境受け入れ

## Context

2026-10-16 の作業で3件が「保留」のまま残った（QA_HANDOFF.md:9, :27）。

- **販売者8画面**: `requireStoreOwner()` が `Store.returnWindowDays` 列不存在で失敗し48件が未実施。
  調査で根本原因を確定: 専用DB `multivendor_e2e` は `_prisma_migrations` 27/27 適用（失敗中なし）で、
  2026-10-15 追加の `20261015042255_add_return_requests` だけ未適用（`multivendor_dev` は 28/28）。
  RMA 実装時に dev DB へだけ適用し、専用DBへの `migrate deploy` が漏れた。構造ずれではない。
  SQL は enum/テーブル新設・`returnWindowDays INTEGER NULL`・`acceptsReturns BOOLEAN NOT NULL DEFAULT true` のみ → 既存データ保持で適用可。
- **フォロー店舗**: テスト顧客にフォロー0件で、実データ表示と実フォロー/解除の反映が未確認。
- **出店申請**: 実Cloudinary upload と申請保存・完了画面が未確認。

ユーザー承認: 3件すべて解除する（DB適用・データ書込・実upload を今回の範囲に含める）。

## 手順

### 0. 計画保存（rule 04）
`plans/layout-design/pending-three-real-route-acceptance-plan.md` に本計画（対象・受け入れ条件・検証方法・後片付け）を保存。

### 1. 専用DBを現行スキーマへ（DS-SELLER-REAUDIT-ROUTES 前提）
- `.env` を読み、`DATABASE_URL`/`DIRECT_URL`/`E2E_DATABASE_URL` を `localhost:5432/multivendor_e2e` に揃える。
- `bunx prisma migrate status` → 1件未適用を確認 → `bunx prisma migrate deploy`（`migrate dev`/`db push` は使わない。seed なし）。
- 事後確認: `_prisma_migrations` 28/28、`Store` に2列、販売者・店舗の既存件数が適用前と同じ。

### 2. 販売者8画面 48件の再実行
- `bun scripts/design/prepare-seller-route.ts <scratchpad>/seller.json`（冪等。所有店舗・注文等を再確認）。
- `DESIGN_SUITE=seller-eight-route DESIGN_BROWSER_CHANNEL=chrome DESIGN_SELLER_ROUTE=<json> bun run test:design`
  表示48（3幅×light/dark×8画面）を `--grep` で選択。横はみ出し・テーマ・axe AA・pageerror・スクショで受け入れ。
- 失敗時は前提を再評価して停止（投機的修正を重ねない）。製品不具合ならTDDで別途修正。

### 3. フォロー店舗（DS-PAGE-022）実データ・実更新
`tests/browser/purchase-route-design.spec.ts` に既存の `withCustomer` / `gotoRoute` / `storefrontControls` / `accessible` を再利用した write テストを1件追加（read-only テスト L575-609 は変更しない）:
1. 事前: following が空であることを確認（違えば fail・状態を明記）。
2. 店舗ページ（seed 店舗 `e2e-store-chromium-w0`）の Follow ボタンで実フォロー → `/profile/following/1` に店舗カード1件、3幅で表示・axe・スクショ。
3. following 画面で解除 → 件数・状態の更新、再読込後も保持を確認。
4. `finally` で未フォロー状態へ戻す（`followStore` はトグルのため状態を見て1回だけ操作）→ 冪等に再実行可能。

### 4. 出店申請（DS-PAGE-004）実Cloudinary・実保存
同 spec に申請送信テストを1件追加:
1. 4段階を入力（店舗名/メール/電話は実行ごとに一意な接尾辞で重複検査を回避）。
2. 画像は Cloudinary Upload Widget の iframe 内 `input[type=file]` に小さなテスト画像（scratchpad に生成、または既存 fixture 画像）を `setInputFiles` → プレビューに `res.cloudinary.com/<cloud>` URL が出ることを確認。
3. 送信 → 完了画面、console に Decimal 等のエラー0（plan 089 の回帰）。
4. DB を読み取り確認: 作成 `Store` の name/email/phone/logo/cover URL・status（PENDING）が入力どおり。
- 後片付け: 作成した `Store` 行をスクリプトで削除（専用DB・作成IDに限定）。Cloudinary 資産は `.env` に API secret が無く自動削除不可 → public_id を記録し、ユーザーがコンソールで削除（報告に列挙）。

### 5. 検証・文書同期
- `bunx tsc --noEmit`、`bun run lint`、`bun run check:playwright`、追加2テストの3回連続 pass（フレーク確認）。
- Jest は変更なし（ブラウザー spec のみ）→ 統計は不変を確認して記載。
- 更新: `docs/testing/QA_HANDOFF.md`（3件の保留解除・再現手順・Cloudinary 後片付け）、`docs/design/design-system/PROGRESS.md`（DS-PAGE-022/004、販売者8画面を検証済みへ）、`plans/layout-design/priority-eight-seller-reaudit-design-system-plan.md` の最終結果、`specs/multi-vendor-ecommerce/07-testing.md` の該当節。
- 再発防止: QA_HANDOFF の seller 再実行手順に「実行前に `prisma migrate status` で専用DBの適用漏れを確認」を明記。
- コミットは依頼時のみ（段階分け: spec追加 / docs同期）。

## 重要ファイル
- `prisma/migrations/20261015042255_add_return_requests/migration.sql`（適用対象）
- `scripts/design/prepare-seller-route.ts`（DB 3変数同値・専用DB検査を再利用）
- `playwright.design.config.ts`（suite `seller-eight-route` / `purchase-route`。新 config は作らない）
- `tests/browser/purchase-route-design.spec.ts`（following/apply の write テスト追加先）
- `src/queries/user.ts:255` `followStore`、`src/queries/store.ts` `applySeller`

## 対象外
本番/Neon DB・`multivendor_dev` への書込、seed 再投入、Integration/本体3ブラウザーE2E の再実行、注文状態更新・メッセージ送信など他画面の実保存。

## 結果（2026-10-16）

- [x] 1. `migrate deploy`（27→28/28、既存データ不変）
- [x] 2. `seller-eight-route` 表示 48/48
- [x] 3. following 実更新テスト追加・合格
- [x] 4. apply 実Cloudinary・実保存テスト追加・合格（作成店舗は削除。Cloudinary アセットは手動削除待ち: QA_HANDOFF）
- [x] 5. 追加2件 ×3 回 6/6、tsc 0・lint 0 errors・`check:playwright` 成功、文書同期
