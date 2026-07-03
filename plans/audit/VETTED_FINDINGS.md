# Vetted Findings — improve スキル deep 監査

- **監査対象 HEAD**: `f9752c0`（branch: `dev`）
- **Vet 日**: 2026-07-03
- **方法**: 各 finding の引用 file:line を本体が**直接開いて確認**。by-design（recon の決定済みトレードオフ表と照合）・evidence 誤帰属・サブエージェント間重複を除去。
- **プラン選定方針**: カテゴリ網羅（意味のある発見があった各カテゴリ最低1件、セキュリティ・direction 必須）。ユーザー承認済みにつき選択待ちなし。

## 直接確認済みの主要 finding（抜粋）

| finding | 確認内容 |
|---|---|
| SECURITY-01 | `order.ts:258` の `orderItem.findUnique({ where: { id } })` に storeId スコープなし（`:193` の兄弟 `orderGroup.findUnique({ where: { id, storeId } })` と非対称）— **実在** |
| SECURITY-02 | `store.ts:90` の `const { id, userId, ...storeDataToUpdate } = store` で status/featured 素通り、`:137` create が `status: store.status ?? "PENDING"` — **実在** |
| SECURITY-03 | `stripe.ts:98,126` がクライアント渡し `paymentIntent.amount`/`.status` をそのまま書き込み、`retrieve` 再検証なし — **実在** |
| CORRECTNESS-04 | `user.ts:251-285` の cart delete(252)→create(260) が `$transaction` 外 — **実在**（コメントは検証後削除に改善済みだが原子性は未対応） |
| PERF-06 | `browse/page.tsx:32` の `await getFilteredSizes({})` 戻り値が未使用（dead + ブロッキング）— **実在** |
| TECHDEBT-05 | `search/search copy.tsx`（3196B・空白入りファイル名）が実在、`search.tsx` の複製 — **実在** |
| DEPS-01 | `package.json` `"@clerk/nextjs": "^7.0.7"`（GHSA-vqx2-fgx2-5wq9 影響圏）— **実在** |
| DIRECTION-02 | `order.ts:538` の在庫復元フック TODO — **実在**（`updateOrderItemStatusAsAdmin` 内、構造化ログ隣接） |
| SECURITY-05 | `index-products/route.ts:134` `{ error: error.message }` + `catch (error: any)` — **実在** |

## Vetted findings 表（leverage 順・impact ÷ effort × confidence）

| # | Finding | Category | Impact | Effort | Risk | Confidence | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | SECURITY-01 クロスストア IDOR: `updateOrderItemStatus` の orderItem を所有店舗にスコープ | security | 他店舗の注文アイテム status を改変可能 | S | LOW | HIGH | `order.ts:258` |
| 2 | SECURITY-02 Store mass-assignment: status/featured/rating の allowlist 化 | security | モデレーション/featured バイパス | S–M | LOW | HIGH | `store.ts:90,137,459` |
| 3 | DEPS-01 `@clerk/nextjs` 7.0.7 → 7.5.x（CRITICAL auth-bypass 圏外へ） | dependencies | middleware 保護ルートのバイパス | S | LOW-MED | HIGH | `package.json:21`, `middleware.ts:6-13` |
| 4 | CORRECTNESS-04 `saveUserCart` の delete→create を `$transaction` 化 | correctness | 部分失敗でカート消失 | S | LOW | HIGH | `user.ts:251-285` |
| 5 | CORRECTNESS-02 cart store の手動 localStorage が persist 形式を破壊 | correctness | アイテム削除後リロードでカート破損 | S | LOW | MED | `useCartStore.ts:206,231,240` |
| 6 | SECURITY-03 Stripe status/amount をサーバー側で `retrieve` 導出 | security | 偽造 intent で未払い注文を Paid 化 | M | MED | MED | `stripe.ts:71,98,126` |
| 7 | SECURITY-04 `placeOrder` の shippingAddress 所有権検証 | security | 他ユーザー住所 PII 露出 | S | LOW | MED | `user.ts:614` |
| 8 | PERF-04 seller store-orders の無制限 findMany をページ化 | perf | 店舗成熟で描画膨張 | S | LOW | HIGH | `store.ts:361-393` |
| 9 | PERF-06 browse ページの破棄クエリ `getFilteredSizes({})` 除去 | perf | 描画毎に無駄な直列 DB 往復 | S | LOW | HIGH | `browse/page.tsx:32` |
| 10 | TECHDEBT-01 エラーログ3系統を `logError` ヘルパーに集約 | tech-debt | ログ集約/アラート不能・調査阻害 | M | LOW | HIGH | `coupon.ts:54…`, `category.ts:65` 他 ~90 |
| 11 | TECHDEBT-06 `src/` UI の残置デバッグ `console.log` 除去 | tech-debt | 規約違反・カート内容をコンソールへ | S | LOW | HIGH | `apply-coupon.tsx:53`, `cart-page/container.tsx:39` |
| 12 | TECHDEBT-05 dead file `search copy.tsx` 削除 | tech-debt | 誤編集誘発・ドリフト | S | LOW | HIGH | `header/search/search copy.tsx` |
| 13 | TECHDEBT-04 インライン Zod を `schemas.ts` へ移動 | tech-debt | 規約4違反・スキーマ分散 | S | LOW | HIGH | `order.ts:294` |
| 14 | CORRECTNESS-03 place-order 二重送信ガード（button disabled + サーバー冪等） | correctness | N 重注文・N 重在庫減算 | M | MED | MED | `place-order.tsx:142`, `user.ts:422-750` |
| 15 | CORRECTNESS-01 Stripe `charge.refunded` の相関失敗 | correctness | 実返金が Order へ反映されず | M | LOW | MED | `webhooks/stripe/route.ts:47-55` |
| 16 | TESTS-07 `computeShippingTotal`（配送料 SSOT）の直接ユニットテスト欠如 | tests | 丸め/WEIGHT/FIXED 境界が未検証 | S | LOW | HIGH | `shipping-utils.ts` |
| 17 | TESTS-05 `placeOrder` オーバーセルロールバック分岐が統合テスト未実施 | tests | 在庫整合の最重要保証が未検証 | M | LOW | HIGH | `user.ts:716-728` |
| 18 | PERF-01 cart/checkout の per-item N+1（product+shipping+country） | perf | N アイテムで 3N〜4N 往復 | M | MED | HIGH | `user.ts:124,449,799,996` |
| 19 | PERF-05 参照データ（categories/countries/offer tags）のキャッシュ化 | perf | 全 force-dynamic ページで再クエリ | S–M | LOW-MED | HIGH | `category.ts:99`, `country.ts:7`, `offer-tag.ts:98` |
| 20 | SECURITY-05 index-products が生 `error.message` を返す | security | 内部/Prisma エラー詳細の開示 | S | LOW | MED | `index-products/route.ts:134,403` |
| 21 | DX-02 stale doc `unimplemented-screens-plan.md` の退役 | docs | 出荷済み作業を再スケジュールし得る | S | LOW | HIGH | `docs/unimplemented-screens-plan.md` |
| 22 | DX-03/04 README env 変数リスト補完 + `.env.example` 追加 | dx | オンボーディング時に部分起動 | S | LOW | HIGH | `README.md:486-496`, `.gitignore` |
| 23 | DX-01 CI 依存/Prisma/ビルドキャッシュ追加（=PERF-09） | dx | 全 CI 実行で回避可能な時間浪費 | S | LOW | HIGH | `.github/workflows/ci.yml` |
| 24 | DEPS-04 Prisma 5.22 → 6.x メジャーラグ（spike） | migration | サポート窓外へ | M | MED | MED | `package.json:24,135` |

> **注**: PERF-09 と DX-01 は同一（CI キャッシュ）。DEPS-02（js-cookie）は DEPS-01 の検証ゲート、独立プラン化しない。

## Direction findings（別立て — メンテナが重み付けする選択肢）

| # | Direction | 根拠 | Effort | 種別 |
|---|---|---|---|---|
| D1 | DIRECTION-02 Cancelled/Returned/Refunded の在庫復元フック | `order.ts:538` TODO・decrement の鏡像 | M | design/spike → build |
| D2 | DIRECTION-03 運営向けサポートチケットコンソール（閲覧+status 更新） | `support.ts:16` に read/update なし・design.md:92 | M | design/spike |
| D3 | DIRECTION-01 Refunded 遷移で実 Stripe/PayPal 返金実行 | `order.ts:554-560` docstring・`08-open-questions.md:7-9` | L | design/spike（HIGH risk 資金移動） |
| D4 | DIRECTION-04 i18n 基盤（next-intl）立ち上げ | `docs/design/i18n-localization/` 設計完備・実装ゼロ | L（Phase 0 は M） | design/spike |
| D5 | DIRECTION-05 エラーモニタリング/可観測性（roadmap Phase 5） | `saas-roadmap.md:76`・OI-9/OI-11 本番クラッシュ追跡中 | M | design/spike |

## プラン化対象（12本・カテゴリ網羅）

1. **001** SECURITY-01（IDOR）— security
2. **002** SECURITY-02（mass-assignment）— security
3. **003** SECURITY-03 + SECURITY-04（決済/注文のサーバー側信頼境界）— security
4. **004** DEPS-01（Clerk アップグレード）— dependencies
5. **005** CORRECTNESS-04 + CORRECTNESS-02（カート整合性: 原子 saveUserCart + persist 一本化）— correctness
6. **006** CORRECTNESS-03（place-order 二重送信ガード）— correctness
7. **007** TECHDEBT-01 + TECHDEBT-06（ログ集約 `logError` + デバッグ log 除去）— tech-debt
8. **008** TECHDEBT-05 + TECHDEBT-04（dead file 削除 + Zod スキーマ移動）— tech-debt
9. **009** PERF-04 + PERF-06（クエリ衛生: ページ化 + 破棄クエリ除去）— perf
10. **010** TESTS-07（`computeShippingTotal` ユニットテスト）— tests
11. **011** DX-02 + DX-03 + DX-04（stale doc 退役 + env ドキュメント/`.env.example`）— dx/docs
12. **012** DIRECTION-02（在庫復元フックの design/spike）— direction

## Considered and rejected（再監査防止）

- **PERF-11 / SECURITY-05 の index-products 重複**: `index-products` と `search-products` のほぼ重複は既知（tech-debt 統合機会）。SECURITY-05 の error.message 漏洩は 011 と別だが低優先のため今回プラン化せず、011 の完了後に単独修正推奨として README に残す。
- **SECURITY-07（PayPal sandbox ハードコード）**: LOW confidence。本番 env 配線の確認が先で、finding としては investigate 止まり。プラン化せず README に investigate として記載。
- **SECURITY-08/09（古い error 補間 / upsertReview 購入検証）**: LOW confidence・Next.js の server-action マスキングで緩和。プラン化見送り。
- **DEPS-05/08、DX-09、TECHDEBT-07**: 非アクション/低優先（dev-only advisory・Next 最新・editorconfig・フォーム抽象 spike）。README の deferred に記載。
- **DEPS-04（Prisma 6.x）/ PERF-01 / PERF-05 / CORRECTNESS-01 / TESTS-05 / DX-01**: 意味のある finding だが 12本の枠外。README の「次点候補」に列挙し、後日 `execute`/追加プラン化の対象とする。
- **決定済みトレードオフ（ADR-001〜005・force-dynamic・reactStrictMode:false・Elasticsearch コメントアウト・middleware→proxy/AVIF 警告・スコープ外の多通貨/税/分析/配送キャリア）**: recon の表どおり finding 化せず。
- **既修正セキュリティ（SECURITY_GAP_REPORT.md: PayPal/Stripe userId スコープ・upsertCoupon 所有権・applyCoupon CAS・review IDOR）**: 全て健在・回帰なしを security サブエージェントが確認。
