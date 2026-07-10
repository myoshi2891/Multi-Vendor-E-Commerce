# Findings 12 — Test Coverage 実測監査（Round 4 / vetted）

> **Round 4**（2026-07-10 / HEAD `b6591f9` / branch `dev`）。`tests` フォーカス監査。
> **方法**: `bun run test -- --coverage` の lcov 実測 → ファイル別 Lines/Branches/Functions 分析 →
> ソース vs テストファイル突合 → **全所見を本体が直接コードを開いて vet 済み**（サブエージェント不使用）。
> Round 1 の raw 所見（`findings-04-test-coverage.md` TESTS-01〜10）との reconcile を含む。

## ベースライン実測（2026-07-10）

| 指標 | 値 |
|---|---|
| Jest unit/component | **1662 passed / 1665 total（3 skipped）/ 172 スイート（171 passed + 1 skipped）** |
| カバレッジ全体 | Statements 65.19%（5529/8481）/ **Branches 44.89%（2270/5056）** / Functions 54.1%（884/1634）/ Lines 64.11%（4962/7739） |
| Integration（testcontainers） | **未実行**（Docker デーモン停止中。前回統計 17 テスト / 2 スイートを維持） |
| QA_HANDOFF 記載値との乖離 | 記載 1659 passed / 1662 total → 実測 **+3**。差分 = `865dda3`（track-order エラー系 + テスト配置移動）・`83fe664`（T-TO11 PII 非ログ検証） |

---

## 新規所見（Round 4・すべて直接 vet 済み）

### [TESTS-11] `src/queries/paypal.ts` のエラー経路分岐が unit テスト未カバー（Branches 28.6%）

- **Evidence**: lcov 実測 — `paypal.ts` Lines 51.3%（40/78）/ **Branches 28.6%（16/56）**。未カバー行:
  `22-35`・`49-62`（`createPayPalPayment` の `currentUser`/`db.order.findUnique` catch 節:
  "Unauthenticated." 再 throw 分岐・`instanceof Error` 真偽の構造化ログ分岐・message 補間）、
  `99-100`（`response.ok === false` → PayPal API status + errorBody の throw）、
  `111`（外側 catch の非 Error 分岐）、`136-152`・`166-179`・`203-204`・`285-295`
  （`capturePayPalPayment` の同型 4 系統）。
- **Evidence**: `src/queries/paypal.test.ts`（17 テスト）は happy path・IDOR・fetch reject のみ。
  catch 節の分岐網羅なし。
- **Impact**: 決済モジュール（money-critical）のエラー経路が回帰無検出。paypal.ts は
  `.claude/steering/tech.md` が「構造化ログ / エラーハンドリングの実装例」と指名する
  **規約の exemplar** であり、その規約遵守自体がテストで固定されていない。
- **Effort**: S / **Risk**: LOW（テスト追加のみ・本体無変更） / **Confidence**: HIGH
- **Fix sketch**: `message.test.ts:567-660` で確立済みの「Error/非 Error 両系統 reject」パターンを
  paypal.test.ts に横展開（+12〜16 テスト）。→ **plan 026**

### [TESTS-12] `src/queries/country.ts` が唯一テストのない server action モジュール（0%）

- **Evidence**: lcov — `country.ts` Lines 0%（0/9）/ Branches 0%（0/2）。`src/queries/` 全 20 モジュール中
  テストファイルが無いのは本モジュールのみ（`ls src/queries/*.test.ts` 突合）。
- **Evidence**: `CLAUDE.md`「テスト要件」表 — Jest ユニットテストの対象は「**全サーバーアクション**」。
  本モジュールはこの不変条件の唯一の違反。
- **Impact**: `getAllCountries` は checkout の国選択に供給される公開経路。小さいが、
  「全 server action にテストがある」という repo 保証が破れているため、新規モジュール追加時の
  基準線が曖昧になる。
- **Effort**: S（1 関数・try/catch 1 個） / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `country.test.ts` 新設（4 テスト: 昇順取得 / DB エラー Error 系 / 非 Error 系 /
  汎用メッセージ throw）。→ **plan 028**
- **補足（重複でないことの確認）**: `plans/024-validate-usercountry-cookie-write.md` の in-scope は
  `src/app/api/setUserCountryInCookies/route.ts` + `src/lib/utils.ts` のみで、本モジュールと**非重複**。

### [TESTS-13] `src/queries/profile.ts` の catch 分岐が 5 関数 × 2 系統で未カバー（Branches 69.2%）

- **Evidence**: lcov — `profile.ts` Lines 67.3% / Branches 69.2%（59/87 → 18/26 branches が catch 系）。
  未カバー行クラスタ: `44-50`・`160-166`・`211-217`・`293-299`・`348-354`・`421-427`・`463-469`・
  `558-564`・`588-594`・`657-663` — `getUserOrders` / `getUserPayments` / `getUserReviews` /
  `getUserWishlist` / `getUserFollowedStores` 各関数の `currentUser` catch と DB catch
  （`instanceof Error` 真偽の両分岐）。加えて `84`・`89`・`242`・`247`・`252`・`374`・`379`・`384` の
  ページ番号正規化・フィルタ分岐の一部。
- **Impact**: プロフィール系 5 テーブル（注文/決済/レビュー/ウィッシュリスト/フォロー）の
  エラー縮退（汎用メッセージへの変換・PII 非ログ）が未検証。
- **Effort**: S–M / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: TESTS-11 と同じ `message.test.ts` パターンの横展開（+10〜14 テスト）。→ **plan 029**

### [TESTS-14] 2026-06 追加機能（track-order / support-forms / compare / offers / static pages）の E2E 導線テストなし

- **Evidence**: `tests/e2e/` の 9 main スペックに上記機能の spec なし（`ls tests/e2e/` 突合）。
  各機能とも component テストは充実（QA_HANDOFF 2026-06-21〜26 の記録どおり）だが、
  ブラウザレベルの配線（footer/user-menu → ページ → server action 往復）は
  `layout-chrome.spec.ts` の chrome 検証のみ。
- **Impact**: track-order と support-forms は**ゲスト可の公開導線**（Clerk 不要 = E2E コstorが低い）で、
  フォーム → server action → DB → 結果表示の縦貫が実ブラウザで未検証。
- **Effort**: M / **Risk**: LOW / **Confidence**: MED（component 層の厚さを考慮すると増分価値は中程度）
- **Fix sketch**: ゲスト系 2 フロー（track-order 照合成功/不一致・support form 送信）を 1 spec に集約。
  → **今回はプラン化せず deferred**（README の次点候補に記載。E2E 追加は 3 ブラウザ実行コストが掛かるため、
  026〜030 の unit/integration 拡充後に価値を再評価）。

---

## Round 1 raw 所見（TESTS-01〜10）との reconcile

| # | Round 1 raw 所見 | Round 4 時点の現状（直接確認） | 裁定 |
|---|---|---|---|
| TESTS-01 | 決済/チェックアウトのクライアント層に component テストなし | **部分解消**: `place-order-card.test.tsx`・`apply-coupon-form.test.tsx`・`cart-product.test.tsx` 等は追加済み。**残余 0%**: `stripe-payment.tsx`（98行/B35）・`paypal-payment.tsx`（46行）・`checkout-page/container.tsx`（98行/B16）・`cart-page/container.tsx`（116行/B18）・`cart-page/summary.tsx`（97行）・`layout/footer/newsletter.tsx`（72行・tech.md リエントランシー exemplar） | **残余を plan 030 に昇格**（Effort L→M に低減） |
| TESTS-02 | capture 経路の非原子 2 書き込みが統合テスト不能 | 未解消。ただしテスト以前に `$transaction` 化（**plan 003** のスコープ隣接）が先 | deferred 維持（コード修正が先行依存） |
| TESTS-03 | charge.refunded fixture が実ペイロードと乖離 | 未解消（CORRECTNESS-01 と同根・deferred 済み） | deferred 維持 |
| TESTS-04 | webhook ハンドラーの統合（実 DB 冪等性）なし | 未解消 | deferred 維持（testcontainers 基盤は 027 で拡張されるため後続候補） |
| TESTS-05 | placeOrder オーバーセルロールバック分岐が統合テスト未実施 | **未解消を再確認**: `user.ts:720-727` の check-and-decrement + `stock.count === 0` throw。`order-placement.test.ts` 6 シナリオの Scenario 3 は事前キャップ（`Math.min`）のため decrement は常に成功し、rollback 経路・減算後 `Size.quantity` の assert なし | **plan 027 に昇格** |
| TESTS-06 | restock 二重実行ガードの実 DB テストなし | 未解消 | deferred 維持（027 完了後の同型拡張候補） |
| TESTS-07 | `computeShippingTotal` 直接ユニットテストなし | 未解消（**plan 010** が TODO のまま） | plan 010 を維持（重複プラン作成せず） |
| TESTS-08 | PLATFORM クーポン残差吸収のセント単位 assert なし | **未解消を再確認**: `user.ts:646-676` の残差吸収分岐（最終グループが `platformTotalDiscount.sub(cumulative)` を吸収）。`order-placement.test.ts` に PLATFORM クーポンのシナリオゼロ（grep 突合） | **plan 027 に統合**（同一ファイル・同一基盤のシナリオ追加） |
| TESTS-09 | `jest.config.js` の page.tsx 一律除外がロジック保有ページを不可視化 | 未解消（`jest.config.js:30` 現存） | deferred 維持（分母変更はダッシュボード全指標に波及するため単独ラウンドで扱う） |
| TESTS-10 | 巨大 UI スナップショットのレビュー不能性（investigate） | 未解消・LOW confidence のまま | investigate 維持 |

## Considered and rejected（Round 4・再監査防止）

- **`src/lib/coupon-utils.ts` / `serialize-cart.ts` / `shipping-utils.ts` の「テストファイルなし」**:
  lcov 実測で **3 ファイルとも間接カバレッジ 100%**（L 6/6・3/3・11/11、B 4/4・4/4・7/7）。
  呼び出し元テスト経由で全行・全分岐が実行済みのため「危険な未テスト」ではない。
  直接テストの SSOT 論拠（オラクル自己整合問題）は shipping-utils についてのみ **plan 010** が既にカバー。
  coupon-utils / serialize-cart への同論拠の横展開は低レバレッジと判定し**却下**。
- **`src/lib/db.ts` 0%**: Prisma シングルトンの配線のみ（6 行）。テスト価値なし。**却下**。
- **`src/components/store/layout/header/search/search copy.tsx` 0%**: dead code。テストではなく
  **plan 008（削除）** の対象。**却下**（テスト所見にしない）。
- **`src/components/ui/chart.tsx` Branches 6.5%**: shadcn/ui プリミティブ。snapshot テスト
  （`tests/component/ui/chart.test.tsx`）が存在し、B1+ 方針（見た目の固定）として意図的。
  分岐網羅の増分価値は低い。**却下**。
- **`src/components/dashboard/forms/product-details.tsx` 0%（169 行 / 392 branches）**:
  実在する最大の 0% だが、**TECHDEBT-02（god component 分割・characterization tests first）** の
  文脈で扱うべき L 効数案件。テスト単独プランにせず TECHDEBT-02 の deferred に従属。**却下**（本ラウンドでは）。
- **dashboard forms 群 0%**（store-details / shippingRate-details / subCategory-details / category-details /
  coupon-details / offer-tag-details 等）: `admin-coupon-details.test.tsx` の既存パターンで
  テスト可能だが、seller/admin 内部 UI で顧客 KPI 直結度が低く、money-path（plan 030）より
  レバレッジが下。**次点候補として README に記載**（プラン化見送り）。

## プラン対応表

| Finding | Plan | 内容 |
|---|---|---|
| TESTS-11 | **026** | paypal.ts エラー分岐 unit テスト |
| TESTS-05 + TESTS-08 | **027** | placeOrder 統合シナリオ追加（オーバーセルロールバック + PLATFORM クーポン端数） |
| TESTS-12 | **028** | country.ts unit テスト新設 |
| TESTS-13 | **029** | profile.ts catch 分岐 unit テスト |
| TESTS-01（残余） | **030** | money-path クライアントコンポーネントの component テスト |
| TESTS-14 | — | deferred（README 次点候補） |

## 副次所見（テスト外・記録のみ）

- `stripe-payment.tsx:28` と `cart-page/summary.tsx:30` に `catch (error: any)` が現存
  （no-any 規約違反。2026-06-22 に `product-card.tsx` で同種を修正した前例 `22bb3f3` あり）。
  **plan 030 実行時に本体修正はしない**（テストのみ）が、maintenance note に記載し
  後続の単独 fix 候補とする。
