# 返品 RMA 画面の認証後実ルート受け入れ（DS-PAGE-068 / DS-COMP-247 / DS-COMP-248・2026-10-17）

## Context

plan 088 Step 5 で実装した返品 UI は RTL と fixture suite `returns` で補助検証済みだが、認証後の実ルートは保留だった。
Step 6（`tests/e2e/returns-rma.spec.ts`）で機能の往復は 3 ブラウザで確認済み。残るのは、過去の実ルート受け入れ
（`seller-eight-route` / `purchase-route`）と同じ水準の表示検証: 3 幅、seller はライト・ダーク、横溢れなし、axe AA 違反 0、
pageerror 0、スクリーンショット。承認: ユーザーの依頼「残りの残作業を進めて」（plan 088 の残作業）。

## 対象

- DS-PAGE-068 `/dashboard/seller/stores/[storeUrl]/returns`、DS-COMP-248 `SellerReturns`
- DS-COMP-247 `ReturnRequestPanel`（`/order/[orderId]` 内。DS-PAGE-003 は検証済みのまま、返品欄だけを確認）

## 変更

1. `scripts/design/prepare-returns-route.ts`（新規）: `prepare-purchase-route.ts` と同じ専用 DB 検査
   （3 変数が同値・localhost・`e2e|test` を含む名前・`multivendor_dev` 以外）と `sk_test_` 検査。
   既存の Clerk テスト利用者（seller: `design-seller+clerk_test@example.com`、顧客: `design-customer+clerk_test@example.com`）を
   作成または再利用し、seller 所有の返品専用店舗 `design-returns-store` を用意する（他 suite の店舗と干渉させない）。
   毎回、その店舗の RMA と注文を消してから、Delivered の注文 1 件（明細 A: 数量 6、明細 B: 数量 2）と、
   6 状態の RMA（REQUESTED / APPROVED〔追跡番号つき〕/ RECEIVED / RESOLVED〔返金額〕/ REJECTED〔却下理由〕/ CANCELED）を投入する。
2. `playwright.design.config.ts` の `DESIGN_SUITES` に `returns-route`（port 3136・route・`NEXT_DEV_DIST_DIR=.next/returns-route`）を 1 行追加。
3. `tests/browser/returns-route-design.spec.ts`（新規）: 読み取りのみ（保存操作はしない）。
   - seller キュー × 1440 / 768 / 390 × light / dark: 200、6 枚のカードと「All (6)」、テーマ、横溢れなし、axe（WCAG A/AA）、pageerror 0、スクショ。
   - seller の入力状態（却下理由欄を開く・受け取りの状態を選ぶ）× 3 幅: 横溢れなし・axe。
   - 顧客の注文詳細の返品欄 × 3 幅: 既存カード 6 枚、キーボードで「Request a return」を開く（`aria-expanded`）、横溢れなし・axe（`main`）、スクショ。

## 対象外

保存・遷移の操作（Step 6 の E2E が担保）、admin の返品画面（未実装）、`multivendor_dev` と Neon への書き込み、seed の再投入。

## 受け入れ条件

全テストが pass。axe AA 違反 0、横溢れなし、pageerror 0、seller はライト・ダークで `html.dark` が切り替わる。

## 検証

`DATABASE_URL` / `DIRECT_URL` / `E2E_DATABASE_URL` を `localhost:5432/multivendor_e2e` に揃え、`bunx prisma migrate status` で適用漏れなしを確認 →
`bun scripts/design/prepare-returns-route.ts <json>` → `DESIGN_SUITE=returns-route DESIGN_BROWSER_CHANNEL=chrome DESIGN_RETURNS_ROUTE=<json> bun run test:design`。
`bun run check:playwright`、`bunx tsc --noEmit`、`bun run lint`。既存実装への回帰確認なので Red は創作しない（不具合が出たら TDD で別途修正）。

## 文書

`docs/design/design-system/PROGRESS.md`（台帳 3 行と記録）、`docs/testing/QA_HANDOFF.md`（再実行手順）、`specs/multi-vendor-ecommerce/07-testing.md`、plan 088 の実施結果。Jest は不変。

## 結果（2026-10-17・未コミット）

- [x] 準備スクリプト・suite・spec を追加（`check:playwright` 成功、tsc 0、lint 0 errors）
- [x] `DESIGN_SUITE=returns-route` 12/12、`--repeat-each=2` 24/24。axe 違反 0、横溢れなし、pageerror 0
- [x] 初回 3 件の失敗は spec のロケーターの部分一致（`Reject` / `Confirm rejection`）で、`exact: true` に修正。製品コードの変更なし
- [x] 台帳（DS-PAGE-068 / DS-COMP-247 / 248 を検証済み）、QA_HANDOFF、07-testing、plan 088 を同期
