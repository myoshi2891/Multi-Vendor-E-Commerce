# Vetted Findings — improve スキル deep 監査

> **本ファイルのラウンド継続運用（読む前に必ず確認）**
>
> 本ファイルは **1 回の監査のスナップショットではなく、ラウンドを積み重ねる台帳**である。
> したがって **単一の「監査対象 HEAD」は存在しない**。
>
> - **Round 1〜3（baseline）**: 下記の「監査対象 HEAD / Vet 日」が適用される。
>   見出しに HEAD 表記の無い節（「直接確認済みの主要 finding」「Vetted findings 表」
>   「Direction findings」「プラン化対象」「Considered and rejected」）は**すべて
>   この baseline のもの**。
> - **Round 4 以降**: 各ラウンドの追記見出しに **`(HEAD, 日付)` を必ず併記**し、
>   その節の finding・行番号・カバレッジ実測値は**その HEAD 時点のもの**として読む。
> - **行番号は採取時点の HEAD に紐づく**。別ラウンドの引用行をそのまま現 HEAD に
>   当てはめないこと（ドリフトの主要因）。各プランの Drift check が
>   「Planned at」コミットを持つのはこのため。
> - **新しいラウンドを追記する際は、見出しを
>   `## Round N 追記 — <観点>（<日付> / HEAD \`<sha>\`）` の形式にすること**（既存の
>   Round 4 見出しがテンプレート）。

## Baseline（Round 1〜3）

- **監査対象 HEAD**: `f9752c0`（branch: `dev`）
- **Vet 日**: 2026-07-03
- **方法**: 各 finding の引用 file:line を本体が**直接開いて確認**。by-design（recon の決定済みトレードオフ表と照合）・evidence 誤帰属・サブエージェント間重複を除去。
- **プラン選定方針**: カテゴリ網羅（意味のある発見があった各カテゴリ最低1件、セキュリティ・direction 必須）。ユーザー承認済みにつき選択待ちなし。

## 直接確認済みの主要 finding（抜粋）— Round 1〜3（HEAD `f9752c0` / 2026-07-03）

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

## Vetted findings 表（leverage 順・impact ÷ effort × confidence）— Round 1〜3（HEAD `f9752c0` / 2026-07-03）

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

## Direction findings（別立て — メンテナが重み付けする選択肢）— Round 1〜3（HEAD `f9752c0` / 2026-07-03）

| # | Direction | 根拠 | Effort | 種別 |
|---|---|---|---|---|
| D1 | DIRECTION-02 Cancelled/Returned/Refunded の在庫復元フック | `order.ts:538` TODO・decrement の鏡像 | M | design/spike → build |
| D2 | DIRECTION-03 運営向けサポートチケットコンソール（閲覧+status 更新） | `support.ts:16` に read/update なし・design.md:92 | M | design/spike |
| D3 | DIRECTION-01 Refunded 遷移で実 Stripe/PayPal 返金実行 | `order.ts:554-560` docstring・`08-open-questions.md:7-9` | L | design/spike（HIGH risk 資金移動） |
| D4 | DIRECTION-04 i18n 基盤（next-intl）立ち上げ | `docs/design/i18n-localization/` 設計完備・実装ゼロ | L（Phase 0 は M） | design/spike |
| D5 | DIRECTION-05 エラーモニタリング/可観測性（roadmap Phase 5） | `saas-roadmap.md:76`・OI-9/OI-11 本番クラッシュ追跡中 | M | design/spike |

## プラン化対象（12本・カテゴリ網羅）— Round 1〜3（HEAD `f9752c0` / 2026-07-03）

1. **001** SECURITY-01（IDOR）— security
2. **002** SECURITY-02（mass-assignment）— security
3. **003** SECURITY-03 + SECURITY-04（決済/注文のサーバー側信頼境界）— security
4. **004** DEPS-01（Clerk アップグレード）— dependencies
5. **005** CORRECTNESS-04 + CORRECTNESS-02（カート整合性: 原子 saveUserCart + persist 一本化）— correctness
6. **006** CORRECTNESS-03（place-order 二重送信ガード）— correctness
7. **007** TECHDEBT-01 + TECHDEBT-06（ログ集約 `logError` + デバッグ log 除去）— tech-debt
   > **注: 007 の TECHDEBT-01 は部分対応**。plan 007 のスコープは
   > 「`logError` ヘルパーの導入 + 裸の `console.error` など優先度の高い箇所の移行」であり、
   > finding が挙げる**約 100 箇所すべての置換は含まない**（残りは後続の段階移行）。
   > したがって 007 完了をもって TECHDEBT-01 が解消済みとは扱わないこと。
   > 段階移行の設計は [`findings-05-tech-debt.md`](findings-05-tech-debt.md) を参照。
8. **008** TECHDEBT-05 + TECHDEBT-04（dead file 削除 + Zod スキーマ移動）— tech-debt
9. **009** PERF-04 + PERF-06（クエリ衛生: ページ化 + 破棄クエリ除去）— perf
10. **010** TESTS-07（`computeShippingTotal` ユニットテスト）— tests
11. **011** DX-02 + DX-03 + DX-04（stale doc 退役 + env ドキュメント/`.env.example`）— dx/docs
12. **012** DIRECTION-02（在庫復元フックの design/spike）— direction

## Considered and rejected（再監査防止）— Round 1〜3（HEAD `f9752c0` / 2026-07-03）

- **PERF-11 / SECURITY-05 の index-products 重複**: `index-products` と `search-products` のほぼ重複は既知（tech-debt 統合機会）。SECURITY-05 の error.message 漏洩は 011 と別だが低優先のため今回プラン化せず、011 の完了後に単独修正推奨として README に残す。
- **SECURITY-07（PayPal sandbox ハードコード）**: LOW confidence。本番 env 配線の確認が先で、finding としては investigate 止まり。プラン化せず README に investigate として記載。
- **SECURITY-08/09（古い error 補間 / upsertReview 購入検証）**: LOW confidence・Next.js の server-action マスキングで緩和。プラン化見送り。
- **DEPS-05/08、DX-09、TECHDEBT-07**: 非アクション/低優先（dev-only advisory・Next 最新・editorconfig・フォーム抽象 spike）。README の deferred に記載。
- **DEPS-04（Prisma 6.x）/ PERF-01 / PERF-05 / CORRECTNESS-01 / TESTS-05 / DX-01**: 意味のある finding だが 12本の枠外。README の「次点候補」に列挙し、後日 `execute`/追加プラン化の対象とする。
- **Direction findings（D1〜D5）の扱い** — 各 1 行で確定させる（再監査防止）:
  - **D1 DIRECTION-02（在庫復元フック）**: **プラン化済み** → plan 012（design/spike）。
    却下ではない。
  - **D2 DIRECTION-03（サポートチケットコンソール）**: **deferred** — 運営コンソールの
    UI 面が広く、012 と同時に着手すると direction の枠を超えるため次ラウンド送り。
  - **D3 DIRECTION-01（実 Stripe/PayPal 返金実行）**: **deferred** — 資金移動を伴い
    HIGH risk。返金の相関（CORRECTNESS-01）が未解決のまま実行系を入れると
    二重返金の危険があるため、相関の確定を先行させる。
  - **D4 DIRECTION-04（i18n 基盤）**: **deferred** — 設計（`docs/design/i18n-localization/`）は
    完備だが Effort L で、現ラウンドのセキュリティ/整合性の優先度に劣後する。
  - **D5 DIRECTION-05（エラーモニタリング/可観測性）**: **deferred** — roadmap Phase 5 の
    項目であり、前提となるログ集約（TECHDEBT-01 / plan 007）が部分対応に留まるため、
    集約の完了後に着手するのが順序として正しい。
- **決定済みトレードオフ（ADR-001〜005・force-dynamic・reactStrictMode:false・Elasticsearch コメントアウト・middleware→proxy/AVIF 警告・スコープ外の多通貨/税/分析/配送キャリア）**: recon の表どおり finding 化せず。
- **既修正セキュリティ（SECURITY_GAP_REPORT.md: PayPal/Stripe userId スコープ・upsertCoupon 所有権・applyCoupon CAS・review IDOR）**: 全て健在・回帰なしを security サブエージェントが確認。

---

## Round 4 追記 — テストカバレッジ実測監査（2026-07-10 / HEAD `b6591f9`）

- **方法**: `bun run test -- --coverage` の lcov 実測 + ソース/テスト突合。全所見を本体が直接 vet
  （サブエージェント不使用）。詳細台帳: [`findings-12-test-coverage.md`](findings-12-test-coverage.md)。
- **ベースライン**: Jest 1662 passed / 1665 total / 172 スイート。
  Statements 65.19% / Branches 44.89%。Integration は Docker 停止のため未実行。

### Round 4 vetted findings 表（leverage 順）— HEAD `b6591f9` / 2026-07-10

| # | Finding | Category | Impact | Effort | Risk | Confidence | Evidence |
|---|---|---|---|---|---|---|---|
| R4-1 | TESTS-11 `paypal.ts` エラー経路分岐が unit 未カバー（B 28.6%） | tests | 決済モジュールのエラー縮退が回帰無検出 | S | LOW | HIGH | `paypal.ts:22-35,49-62,99-100,136-179,203-204,285-295` |
| R4-2 | TESTS-05+08 `placeOrder` オーバーセルロールバック / PLATFORM 端数吸収が統合テスト未実施 | tests | 在庫整合・割引金額の最重要保証が実 DB 未検証 | M | LOW | HIGH | `user.ts:720-727`, `user.ts:646-676` |
| R4-3 | TESTS-12 `country.ts` が唯一テストのない server action（0%） | tests | 「全 server action テスト済み」不変条件の唯一の違反 | S | LOW | HIGH | `country.ts:5-19` |
| R4-4 | TESTS-13 `profile.ts` catch 分岐 5 関数×2系統未カバー（B 69.2%） | tests | プロフィール 5 テーブルのエラー縮退未検証 | S–M | LOW | HIGH | `profile.ts:44-50,160-166,211-217,293-299,348-354,…` |
| R4-5 | TESTS-01 残余: money-path クライアント 6 ファイルが 0% | tests | チェックアウト KPI 直結 UI の回帰無検出 | M | LOW-MED | HIGH | `stripe-payment.tsx` / `checkout-page/container.tsx` / `cart-page/{container,summary}.tsx` / `paypal-payment.tsx` / `newsletter.tsx` |
| R4-6 | TESTS-14 2026-06 新機能のゲスト E2E 導線なし | tests | ブラウザ縦貫の配線未検証（component 層は厚い） | M | LOW | MED | `tests/e2e/`（spec 不在） |

### Round 4 プラン化

**026**（TESTS-11）/ **027**（TESTS-05+08）/ **028**（TESTS-12）/ **029**（TESTS-13）/ **030**（TESTS-01 残余）。
TESTS-14 は deferred（README 次点候補）。

### Round 4 considered and rejected（再監査防止）

- **coupon-utils / serialize-cart / shipping-utils の「テストファイルなし」**: 間接カバレッジ 100%（lcov 実測）のため危険な未テストではない。直接テストの SSOT 論拠は plan 010（shipping-utils）のみ維持。
- **db.ts 0%**: シングルトン配線 6 行。テスト価値なし。
- **`search copy.tsx` 0%**: dead code — plan 008（削除）の対象でありテスト所見にしない。
- **chart.tsx B 6.5%**: shadcn プリミティブ・snapshot 済み・B1+ 方針どおり。
- **product-details.tsx 0%（169L/392B）**: TECHDEBT-02（characterization tests first・L 効数）に従属。単独テストプラン化せず。

## Round 5 追記 — Integration テスト特化監査（2026-07-11 / HEAD `1750ef2`）

- **方法**: `bun run test:integration` の実測（Docker 起動済み）→ 既存 17 テストの検証境界と実
  アサーションの突合 → `$transaction` / raw SQL / webhook 全サイトの直接読解による gap 精査。
  全所見を本体が直接 vet（サブエージェント不使用）。詳細台帳:
  [`findings-13-integration-coverage.md`](findings-13-integration-coverage.md)。
- **ベースライン**: Integration **17 passed / 17 total / 2 スイート**（exit 0 / 4.779s）。
  Round 4 の「Docker 停止により未実測」状態を解消した初の実測。
- **スコープ**: `tests/integration/`（testcontainers 実 PostgreSQL・[ADR-004](../../docs/architecture/decisions/004-integration-test-db-strategy.md)）限定。
  `prisma/seed/__tests__/` は別 tier のため対象外。plan **027**（TESTS-05+08）とはシナリオ非重複を個別確認。

### Round 5 vetted findings 表（leverage 順）— HEAD `1750ef2` / 2026-07-11

| # | Finding | Category | Impact | Effort | Risk | Confidence | Evidence |
|---|---|---|---|---|---|---|---|
| R5-1 | TESTS-15 注文キャンセル/返金の子連動 + 在庫復元（restock）が実 DB 未検証（TESTS-06 の昇格・拡張） | tests | 在庫復元の二重実行（幽霊在庫→オーバーセル誘発）と部分連動を検出できない | M | LOW | HIGH | `order.ts:562-651`（条件付き `updateMany` + `transition.count === 1` の TOCTOU ガード / `:616-625` / `:632-638`） |
| R5-2 | TESTS-16 webhook ハンドラーの実 DB 冪等性（upsert + unique 制約 + 原子性）が未検証（TESTS-04 の昇格） | tests | webhook は Stripe/PayPal が**再送を前提**とする経路。再配送冪等性が挙動レベルで未検証 | M | LOW | HIGH | `webhooks/stripe/route.ts` / `webhooks/paypal/route.ts`（passthrough モックのみ） |
| R5-3 | TESTS-17 tsvector 全文検索の raw SQL がどのテストでも実行されていない | tests | Elasticsearch → tsvector 移行（`docs/migration/` 記録済みの決定）の**中核 SQL が未実行** | S–M | LOW | HIGH | `search-products/route.ts:33-44`（`$queryRaw` / `plainto_tsquery`） |
| R5-4 | TESTS-18 `upsertReview` の評価集計（rating / numReviews）が実 DB 未検証 | tests | rating / numReviews はストアフロントの商品カード・詳細・ストアページに露出する集計値 | S | LOW | HIGH | `upsertReview`（集計更新経路） |
| R5-5 | TESTS-19 `updateStoreStatus` の PENDING→ACTIVE ロール昇格遷移が実 DB 未検証 | tests | ロール昇格は**権限境界の変更**（USER → SELLER）。誤発火はダッシュボード露出に直結 | S | LOW | HIGH | `store.ts`（`updateStoreStatus` のロール昇格分岐） |

### Round 5 プラン化

**031**（TESTS-15）/ **032**（TESTS-16）/ **033**（TESTS-17）/ **034**（TESTS-18）/ **035**（TESTS-19）。

### Round 5 considered and rejected（再監査防止）

- **`saveUserCart` の統合テスト**（`user.ts:104-`）: 非原子な findFirst → 検証 → 書き込みは **plan 005（cart-integrity）のコード修正スコープ**。修正前に characterization を固定すると 005 実行時に書き直しになるため **005 完了後の追加候補**として繰延。
- **`sendMessage` の配列 `$transaction`**（`message.ts:246`）: 2 文のみで分岐なし。unit（`message.test.ts`）で構造検証済みであり実 DB の増分不変条件が薄い — 低レバレッジ。
- **`updateProduct` の specs/questions 削除+再作成 tx**（`product.ts:327-`）: 実 DB 価値はあるがダッシュボード編集経路で money-path ではない。031〜035 より低レバレッジのため**次点候補**として README Deferred に記録（→ **R6 で TESTS-22 として昇格**）。
- **`subCategory.ts` の `ORDER BY RANDOM()` 単独プラン化**: 出力が非決定的で assert 対象が定まらない。

## Round 6 追記 — Integration 次点候補の深掘り監査（2026-07-11 / HEAD `4ec6b5b`）

- **方法**: R5（findings-13）が「`$transaction` / raw SQL / webhook 全サイト」を精査済みのため、
  本ラウンドは **R5 次点候補・FK セマンティクス・default 不変条件**へ対象を移す。
  全所見を本体が直接 vet。詳細台帳:
  [`findings-14-integration-coverage-r6.md`](findings-14-integration-coverage-r6.md)。
  監査 HEAD は R5（`1750ef2`）から `src/ tests/ prisma/` 無変更を diff で確認済み。
- **ベースライン**: Integration **17 passed / 17 total / 2 スイート**（exit 0 / 4.008s）。
  R5 と同一構成（ソース無変更のため当然の一致）。

### Round 6 vetted findings 表（leverage 順）— HEAD `4ec6b5b` / 2026-07-11

| # | Finding | Category | Impact | Effort | Risk | Confidence | Evidence |
|---|---|---|---|---|---|---|---|
| R6-1 | TESTS-20 `deleteProduct` の FK Restrict / カスケード削除の実セマンティクスが未検証 — レビュー付き商品は削除不能（P2003） | tests | **レビューが 1 件でも付いた商品はセラーが削除できず**、ダッシュボードで未処理エラーになる | S–M | LOW | HIGH | `product.ts:557-589` + `migration.sql` の FK 定義 |
| R6-2 | TESTS-21 `upsertShippingAddress` の default 不変条件（1 ユーザー 1 default）が実 DB 未検証 — 新規作成経路は他住所の default を解除しない | tests | default 二重化は **checkout の配送先自動選択を非決定にする**（意図しない住所への配送） | S | LOW | HIGH | `user.ts:345-410`（`seedShippingAddress` は `seed.ts:398` に既存） |
| R6-3 | TESTS-22 `updateProduct` の削除+再作成 tx と slug 一意性・SetNull 副作用が実 DB 未検証（**R5 次点候補の昇格**） | tests | tx 半置換・slug 衝突・sizes 再作成の Wishlist SetNull 連鎖は実 DB でしか観測できない | M | LOW | HIGH | `product.ts:297-469`（`:327-346` / `:442-455` / `:458-467`） |
| R6-4 | TESTS-23 `getProducts`（browse 主経路）のフィルタ合成・ソート・ページングが実 DB 未検証 | tests | browse は検索（033 の tsvector）と並ぶ**商品発見の主経路**。8 フィルタの動的合成が未検証 | M | LOW | HIGH | `product.ts:601-794`（`whereClause.AND` に 8 フィルタを動的合成） |

### Round 6 プラン化

**036**（TESTS-20）/ **037**（TESTS-21）/ **038**（TESTS-22）/ **039**（TESTS-23）。

> **038 の失敗注入に関する注記**: findings-14 の Fix sketch ⑤ は当初「不正 `categoryId` 等の
> FK 違反」としていたが、plan 038（`:213-231`）がこれを**否決**している（tx の最初の操作で
> 失敗するため原子性の証拠にならない）。正しくは **Size 全置換より後段**への注入で、038 は
> plan 035 と同型の一時 CHECK 制約を採用する。**注入手段の正は plan 038**（2026-07-17 に
> findings-14 側を訂正済み）。

### Round 6 R5 deferred/次点の再裁定（A 軸）

- `updateProduct` tx（R5 次点候補）→ **TESTS-22 として昇格**（plan 038）。
- `saveUserCart`（R5 rejected）→ plan 005 が依然 TODO・非原子構造は不変 → **deferred 維持**（005 完了後の追加候補）。
- TESTS-02 capture 経路（R1 raw / R5 deferred）→ plan 003 が依然 TODO・`stripe.ts`/`paypal.ts` の非原子 2 書き込みは不変 → **deferred 維持**。

### Round 6 considered and rejected（再監査防止）

- **`followStore` トグル**（`user.ts:29-92`）: implicit M2M join（`_StoreFollowers`）が (A,B) unique を持ち二重 connect は Prisma レベルで冪等。実害は「トグル結果が 1 回分ずれる」に留まり unit（`user.test.ts:129-`）で分岐網羅済み — 低レバレッジ。
- **`addToWishlist` の重複ガード**（`user.ts:912-952`）: `Wishlist` に**複合 unique 制約が存在しない**（`schema.prisma:641-661` は index のみ）ため、実 DB で検証できる制約セマンティクスがそもそもない。unique 制約の追加はスキーマ変更でありコード修正系 — 本ラウンド範囲外。

## Round 7 追記 — Integration 残余領域の監査（2026-07-11 / HEAD `9111f41`）

- **方法**: R5（`$transaction` / raw SQL / webhook 決済サイト）・R6（FK カスケード / default 不変条件 /
  browse クエリ）が精査済みの領域を除いた**残余**を対象とする第 3 弾。全所見を本体が直接 vet。
  詳細台帳: [`findings-15-integration-coverage-r7.md`](findings-15-integration-coverage-r7.md)。
  監査 HEAD は R6（`4ec6b5b`）から `src/ tests/ prisma/` 無変更を R6 クローズ時に確認済み。
- **ベースライン**: Integration **17 passed / 17 total / 2 スイート**（exit 0 / 4.473s）。R5 / R6 と同一構成。

### Round 7 vetted findings 表（leverage 順）— HEAD `9111f41` / 2026-07-11

| # | Finding | Category | Impact | Effort | Risk | Confidence | Evidence |
|---|---|---|---|---|---|---|---|
| R7-1 | TESTS-24 Clerk webhook `user.deleted` の `db.user.deleteMany` — RESTRICT / CASCADE / SET NULL 混在の FK 連鎖が実 DB 未検証 | tests | **注文・レビュー・住所・店舗を 1 件でも持つユーザーは削除不能**（P2003 → 500 → Svix のリトライ枯渇 + **PII 残存**） | S–M | LOW | HIGH | `webhooks/route.ts`（`user.deleted` 分岐）+ `migration.sql` の FK 定義 |
| R7-2 | TESTS-25 `Coupon.code` はグローバル unique だが `upsertCoupon` の事前チェックは自店舗スコープのみ — 他店舗/PLATFORM とのコード衝突は**決定論的に** P2002 へ到達 | tests | クーポンコードはセラーが自由入力する日常運用値。店舗間衝突が未検証 | S | LOW | HIGH | `coupon.ts`（自店舗スコープの事前チェック）+ `schema.prisma`（`Coupon.code` グローバル unique） |

### Round 7 プラン化

**040**（TESTS-24）/ **041**（TESTS-25）。

### Round 7 considered and rejected（再監査防止）

- **category/subCategory/offerTag upsert 群**（`category.ts:19-70` 等）: 事前チェックが**グローバルスコープ**で unique 制約と整合しており、coupon（TESTS-25）のようなスコープ不一致がない。P2002 到達は真の race 限定で決定論的に再現不能 — 低レバレッジ。
- **`applySeller` / `upsertStore` の一意性検証**（`store.ts:20-156` / `:416-478`）: 事前チェックは name/url/email/phone の 4 値 OR だが **DB unique は url・email のみ**（`schema.prisma:87,89`）。この不一致は characterization 可能だが事前チェックを通る経路では到達不能。さらに **plan 002（mass-assignment allowlist）が upsertStore の update 経路を変更予定**で先行テストは書き直しリスク — 低レバレッジ + 先行依存（002 完了後の再評価候補）。
- **profile 読み取り群**（`getUserOrders` `profile.ts:32-180` / `getUserPayments` 等）: **plan 039（getProducts）と同じ Prisma クエリセマンティクス族**で 039 が回帰網を先に張る。userId スコープ（`:60`）は unit で where 構造検証済み — 039 と重複。

## Round 8 追記 — E2E テスト網羅性監査（2026-07-11 / HEAD `fbd1020`）

- **方法**: 全 Round を通じて**初の 3 ブラウザフル実測** + 網羅性監査。`tests` フォーカス・
  **E2E（Playwright）限定**。全所見を本体が直接 vet。詳細台帳:
  [`findings-16-e2e-coverage.md`](findings-16-e2e-coverage.md)。監査 HEAD は R7 クローズコミットで、
  R7 クローズ時に `src/ tests/ prisma/` の diff 空を検証済み。
- **ベースライン（実測 #2 = クリーンラン / 本ラウンドの SSOT）**:
  **52 passed / 17 failed / 39 skipped / 3 did not run**（111 total / exit 1）。
  実行時間 **25.5m**（`next build` 込み・1 worker 直列）。
  実行コマンド `bash scripts/e2e/run-local.sh --global-timeout=3600000`。
- **17 failed は 3 種の根本原因に収束**: TESTS-26（signIn ドリフト・**13 件**）/
  TESTS-27（`svg-img-alt`・**1 件**）/ TESTS-28（VRT 陳腐化・**3 件**）。
- **本ラウンドの制約**: `src/` / `tests/` / `scripts/` の変更を伴う所見は**プラン化のみ**で実装しない。

### Round 8 vetted findings 表（leverage 順）— HEAD `fbd1020` / 2026-07-11

| # | Finding | Category | Impact | Effort | Risk | Confidence | Evidence |
|---|---|---|---|---|---|---|---|
| R8-1 | TESTS-26 `signIn()` ヘルパーの Clerk UI ドリフト — 識別子がフッター Newsletter 入力欄へ誤入力され、認証依存 E2E **16 件**（13 failed + 3 did not run）が全滅 | tests | **単独で 16 テスト instance を回復**し、認証系の全新規プランの前提を解除する — 本ラウンド最大 leverage | M | MED | HIGH | 実測ログ（messages ×3 / platform-coupon ×3 / seller-onboarding `:74` ×3 / stock-decrement ×2 / a11y checkout・profile） |
| R8-2 | TESTS-27 `/sign-in` の a11y 実違反 `svg-img-alt`（serious）— フッター SendIcon に代替テキスト無し | tests / a11y | 実 WCAG 違反。auth 修復後は checkout/profile a11y も同一違反で fail する | S | LOW | HIGH | a11y sign-in（chromium）実測 |
| R8-3 | TESTS-33 ゲスト E2E 導線（track-order / compare / offers / 静的ページ）— **TESTS-14 の昇格**。認証不要で最も安定な未カバー領域 | tests | 依存ゼロで即着手可能・CI 安定価値最大 | M | LOW | MED | `tests/e2e/`（spec 不在） |
| R8-4 | TESTS-28 VRT スナップショット陳腐化 — cart 2 枚 + checkout 1 枚がベースラインとページ実体の乖離で fail | tests | 視覚回帰ゲートが常時赤で機能していない | S | MED | HIGH | visual/cart ×2 + visual/checkout ×1（chromium） |
| R8-5 | TESTS-29 E2E 実測の運用ガード欠如 — :3000 占有チェック無し / `globalTimeout` が実測 wall-clock に不足 / CI に E2E ジョブ無し | dx | 実行のたびに人手の前提確認が必要。config の 1200s は実測 25.5m に不足 | S | LOW | HIGH | `playwright.config.ts` / `.github/workflows/ci.yml` |
| R8-6 | TESTS-31 注文詳細ページ（`/order/[orderId]`）の金額明細・支払い UI が E2E 未検証 | tests | §20 P0「分割注文/請求」の**請求側が未固定** | M | MED | MED | `src/components/store/order-page/*` |
| R8-7 | TESTS-30 payment-error「住所未選択エラー」skip は解消可能 — skip 理由が `createCustomerSession` 登場前の負債 | tests | 現行実装なら un-skip 可能な陳腐化 skip | S | MED | MED | `payment-error` spec の skip 理由 |
| R8-8 | TESTS-32 search-filter ページネーション skip — **/browse にページネーション UI 自体が未実装**（プラン執筆時の再監査で訂正） | tests | テストの問題ではなく**機能未実装**。最小配線が先行 | M | MED | HIGH | `search-filter.spec.ts:63-70`（route-mock skip） |
| R8-9 | TESTS-34 ウィッシュリスト E2E ゼロ — UI・server action・専用ページが揃っているのに導線未検証 | tests | 実装済み機能の縦貫未検証 | M | MED | MED | `tests/e2e/`（spec 不在） |
| R8-10 | TESTS-35 ストアフォロー E2E ゼロ — followersCount の楽観更新 UI が未検証 | tests | 楽観更新の巻き戻り挙動が未検証 | M | MED | MED | 同上 |
| R8-11 | TESTS-36 レビュー投稿 E2E ゼロ — 星評価 UI に testid 契約が既にある | tests | testid が既にあり着手容易 | M | MED | MED | 同上 |
| R8-12 | TESTS-38 管理者「店舗ステータス変更 → ストアフロント反映」E2E ゼロ（§20 P1）— seller-onboarding 2 本目が唯一の隣接テストだが serial 連鎖で 1 度も実行されていない | tests | 管理操作のストアフロント反映が未検証 | M | MED | MED | `seller-onboarding` spec（serial 連鎖） |
| R8-13 | TESTS-37 プロフィール系 UI（注文履歴ページング・住所管理）E2E ゼロ | tests | プロフィール導線の縦貫未検証 | M | MED | MED | `tests/e2e/`（spec 不在） |

### Round 8 プラン化

**042**（TESTS-26+27）/ **043**（TESTS-28）/ **044**（TESTS-29）/ **045**（TESTS-33、TESTS-14 昇格）/
**046**（TESTS-32 訂正版）/ **047**（TESTS-30+31）/ **048**（TESTS-34+35+36）/ **049**（TESTS-37）/
**050**（TESTS-38）。

**着手順**: TESTS-26（042）が **042 → 047/048/049/050 の先行依存**（認証系すべて）。
TESTS-27 は 042 に同梱（26 と直列で a11y 2 spec を回復）。043 / 044 / 045 / 046 は独立（認証不要）。

### Round 8 deferred（再評価条件つき）

- **販売者ダッシュボード CRUD E2E**（商品・在庫・クーポン・配送）: **ユーザー決定済み deferred**。OI-11（`self is not defined` — 本番ビルドで `/dashboard/seller` 系 SSR エラー）が先行。
- **決済失敗ロールバック E2E（§20 P0）**: Stripe テストモードの失敗カード + 実キーが必要で effort L。
- **payment-error `:58` 在庫切れ表示 skip**: カートページに Out of stock 表示機能自体が未実装（UI 実装が先）。
- **payment-error `:70` 二重送信冪等性 skip**: 冪等性トークン未実装（**plan 006 が先行依存**）。
- **mobile-responsive skip 2 件**（ハンバーガーメニュー / 375px カート）: いずれも**機能未実装**が skip 理由としてテスト名に明記済み。

### Round 8 considered and rejected（再監査防止）

- **ページネーションを route-mock 方式で復活**: 現 skip 実装（`search-filter.spec.ts:63-70`）がまさに route-mock で、SSR ページに効かず壊れた実績。実サーバー検証にならない（→ 046 は seed + 実配線方式）。
- **3 ブラウザフル E2E の CI 常設**: wall-clock 25.5m+ と Clerk 実キーの secrets 運用が前提。まず TESTS-26 修復でローカル green を回復してから chromium 単独で検討。
- **a11y `color-contrast` ルールの有効化**: 既知デザイン負債として QA_HANDOFF「a11y color-contrast 負債」で追跡中（`a11y/checkout.spec.ts:78-80` の disabled）。

## Round 9 追記 — E2E 残余監査（2026-07-12 / HEAD `25e50d9`）

- **方法**: R8（findings-16）が全 spec の網羅性を精査済みのため、本ラウンドは**残余領域**を対象と
  する第 2 弾（R6/R7 の integration 残余監査と同型）。全所見を本体が直接 vet。詳細台帳:
  [`findings-17-e2e-coverage-r9.md`](findings-17-e2e-coverage-r9.md)。監査 HEAD は R8 クローズコミットで、
  R8 監査 HEAD（`fbd1020`）から `src/ tests/ prisma/` 無変更を R8 クローズ時に検証済み。
- **ベースライン（再実測なし）**: ソースが R8 実測時から無変更のため 3 ブラウザ再実測は行わない
  （同一結果の再導出に 25.5m を費やすだけ）。**findings-16 の実測 #2 を引き続き SSOT** とする:
  52 passed / 17 failed / 39 skipped / 3 did not run（111 total）。
  **実効カバレッジ: ゲスト導線のみ green**。認証系 E2E は全滅（plans 042〜050 で修復予定・未実行）。

### Round 9 vetted findings 表（leverage 順）— HEAD `25e50d9` / 2026-07-12

| # | Finding | Category | Impact | Effort | Risk | Confidence | Evidence |
|---|---|---|---|---|---|---|---|
| R9-1 | TESTS-40 国選択セレクタ（Ship to）E2E ゼロ — cookie 書き込み → SSR 再描画の往復が未検証 | tests | **ゲスト到達可能で依存ゼロの最有力候補**。cookie 往復は配送料計算の前提 | S | LOW | HIGH | `setUserCountryInCookies` route + `country-lang-curr-selector.tsx` |
| R9-2 | TESTS-41 認証サーフェスのスモーク E2E ゼロ — サインアップウィジェット描画とサインアウト導線が未検証 | tests | **TESTS-26 と同型のウィジェットドリフトを検出する層が無い**（R8 の 16 件全滅を早期検出できる） | S | LOW | HIGH | `tests/e2e/`（spec 不在） |
| R9-3 | TESTS-43 a11y スキャン対象がストアフロント主要 4 ページに未拡大（home / browse / 商品詳細 / cart） | tests / a11y | 全てゲスト到達可能で**認証修復に依存しない** | S–M | LOW | HIGH | `tests/e2e/a11y/`（sign-in / checkout / profile のみ） |
| R9-4 | TESTS-42 ゲストカート → サインイン後のカート引き継ぎ（`saveUserCart` 往復）E2E ゼロ | tests | 「未認証エラー」までは既存カバーがあるが**認証後の同一カート持ち越しは未検証** | M | MED | MED | `saveUserCart`（`user.ts:104-`）+ 既存カート spec |
| R9-5 | TESTS-44 VRT 対象が cart / checkout リダイレクトの 3 枚のみ — 商品詳細・browse のレイアウト回帰が視覚検証されていない | tests | 主要導線の視覚回帰が未ゲート | S–M | MED | MED | `tests/e2e/visual/` |
| R9-6 | TESTS-39 Newsletter 購読が dormant 404 — フッターのフォームは `/api/newsletter` へ POST するが **route がリポジトリに存在せず**、成功系が構造的に到達不能 | tests | 機能が dormant。**成功系は実装が先行**のため characterization のみ | S | LOW | HIGH | `newsletter.tsx`（POST 先）+ `src/app/api/`（route 不在） |

### Round 9 プラン化

**051**（TESTS-40）/ **052**（TESTS-43）/ **053**（TESTS-41）/ **054**（TESTS-44）/
**055**（TESTS-42）/ **056**（TESTS-39）。

**着手順**: 051 / 052 / 053 / 056 は独立（ゲスト到達可能・認証修復に非依存）。
055 は **042 が先行依存**（認証必須）。054 は **043**（VRT 再撮影）が先行依存。

### plan 057 の provenance（Round 9 のプラン化には属さない）

**057 は本ラウンド（E2E 残余監査）の産物ではない**。上記 051〜056 は TESTS-39〜44 に
対応する `tests` フォーカスの成果物だが、057 は**依存監査由来の独立プラン**であり、
カテゴリも `dependencies`（E2E ではない）。

- **作成**: `7f7bb71`（2026-07-17）。`next` が 16.2.1 に解決され、
  GHSA-26hh-7cqf-hhc6（**HIGH** — App Router の segment-prefetch 経由の
  Middleware/Proxy バイパス。影響範囲 `>=16.0.0 <16.2.5`）に該当することが
  計画時点で確認された。併せて GHSA-8h8q-6873-q5fj（HIGH / Server Components DoS）と
  GHSA-3g8h-86w9-wvmq（LOW / redirect cache poisoning）— 3 件とも 16.2.5 で修正。
- **plan 004 との関係**: 004 が Clerk 側で塞いだのと**同じ攻撃面が 1 層下で再度開いた**もの。
  `src/middleware.ts` が `createRouteMatcher` + `auth.protect()` で
  `/dashboard`・`/checkout`・`/profile` を守っていても、バイパスが Next.js 自身の
  middleware/prefetch 処理にある以上 Clerk バンプでは塞がらない。004 は Next.js の
  アップグレードを明示的にスコープ外としていたため別プランになった。
- **Round 1 の DEPS-08 との関係**: [`README.md`](../README.md) の
  "Findings considered and rejected" にある「DEPS-08 Next.js 16.2.1: already current —
  no action」は **Round 1（HEAD `f9752c0` / 2026-07-03）時点の判断であり現在は無効**。
  advisory は当時未公表。**057 を「再監査済みの却下事項」と誤認しないこと**。
- **recon の依存監査表との関係**: [`recon.md`](recon.md) の `bun audit` 証跡表と
  「監査後の変化」表は**いずれも `next` を含まない**（監査時点で advisory が
  存在しなかったため）。057 の根拠は recon ではなく上記 `7f7bb71` の計画時点検証にある。

### Round 9 deferred（再評価条件つき）

- **R8 deferred 5 件の再裁定**: 販売者ダッシュボード CRUD（OI-11 依存）/ 決済失敗ロールバック / payment-error `:58` 在庫切れ表示 / `:70` 二重送信（plan 006 依存）/ mobile-responsive 2 件 — **いずれも deferred 維持**（先行条件に変化なし）。
- **TESTS-39 の成功系 E2E（Newsletter 購読）**: **機能実装が先行**（route + スキーマ migration + 保存先設計が丸ごと不在）。plan 046 方式の最小配線で吸収できる規模を超える（056 は characterization のみ）。
- **home（`/`）の a11y / VRT**: **OI-9（`featured.tsx` SSR 500）の解消が先行依存**。browse / 商品詳細 / cart と scope 分割し、OI-9 解消後に追加（TESTS-43 / TESTS-44）。

### Round 9 considered and rejected（再監査防止）

- **カスタム 404 ページの E2E**: `src/app/` に `not-found.tsx` / `error.tsx` が存在せず（find で 0 件）、検証対象は Next.js デフォルト 404 のみ。フレームワーク挙動の検証は価値が薄い。
- **フル サインアップ E2E（確認コード入力 → セッション成立まで）**: Clerk test mode 固定コード（424242）前提のフロー全長テストは、`auth.ts` が API 直でユーザー作成する現行設計と重複投資。ウィジェット描画スモーク（053）で足りる。
- **言語 / 通貨セレクタの E2E**: `country-lang-curr-selector.tsx:106-128` の Language / Currency 欄は**静的表示のみ**（onChange ハンドラ無し）。多通貨対応は `product.md` の**スコープ外**。
- **dashboard forms 群 0%**: 内部 UI・money-path よりレバレッジ下位。README 次点候補へ。

---

## Round 10 追記 — CodeRabbit ローカルレビュー triage（2026-07-17 / HEAD `739097c`）

> **本ラウンドの出所が他と異なる点に注意**: 本節は improve スキルの監査ではなく、
> **CodeRabbit VSCode 拡張のローカルレビュー**（未プッシュの 25 コミット `origin/dev..dev`
> を対象）に対する triage 記録である。指摘は GitHub 上に存在せず `gh api` で取得できない
> （PR #153 の CodeRabbit コメント 30 件は別物で、いずれも `edaee52`〜`a2c1cee` で対応済み）。
> 根拠はスクリーンショットの「ファイル + 行範囲 + 1 行タイトル」のみのため、
> **各指摘を実コードへ照合してから採否を決めた**。
>
> **スコープ**: 全 73 件のうち src/ 4 件 + docs/テスト統計整合 10 件 = 14 件を対象とした。
> **plans/ 計画書 59 件は次段へ繰り越し**（本ラウンド未着手）。

### Round 10 accepted — src/ 本番コード（4 件すべて妥当）

| # | 対象 | 判定 | 実コード照合の根拠 | コミット |
|---|------|------|-------------------|---------|
| CR-01 | `place-order.tsx` | **妥当・実バグ** | `await emptyUserCart()` が `navigating = true` より前にあり、後片付けが throw すると `catch`→`finally` でガードが解放される。**注文は成立済みなのに再実行可能**だった。フラグを `orderPlaced` に改名し注文確定と同時に立てる形へ | `5192aea`→`cc7468c` |
| CR-02 | `order.ts` | **妥当** | `src/lib/log.ts` の `logError` が既存で `coupon.ts` は全面移行済み。order.ts のみ inline `console.error` が残存。**error ログ 7 箇所のみ**を統合し、監査ログ 3 箇所（`[Admin:*] actor=...`）は error ではないため対象外とした | `cd12973` |
| CR-03 | `stripe.ts` | **妥当（ただし字面どおりの適用は不可）** | 下記「解釈の修正」を参照 | `91020b3`→`ab97f8f` |
| CR-04 | `user.ts` | **妥当（軽微）** | `Cart.userId` は `@unique`。`findFirst`(旧 117 行) と `$transaction` の間に TOCTOU があり、並行保存で `delete` の P2025 / `create` の P2002 が発生しうる。tx によりデータ破損はしないが正当なリクエストが偽エラーで落ちる。Serializable + 冪等 `deleteMany` + 事前読取り撤去で解消 | `f4bddb3`→`f046d22` |

#### CR-03 の解釈の修正（記録すべき判断）

指摘タイトルは「注文に対する有効な PaymentIntent を一意に検証してください」。
当初これを **「`status !== "succeeded"` なら拒否」** と解釈して計画したが、実コード照合の結果
**この実装は既存仕様と既存テストを破壊する**と判明したため破棄した:

- `stripe.ts` の `toOrderPaymentStatus` は `succeeded` / `canceled` / `processing` /
  `requires_action` 等を**意図的に全て写像**する設計（in-flight を `Failed` で確定させず
  `Pending` に留める意図は同関数の docstring に明記）。
- `stripe.test.ts`「取消済み intent は Cancelled に更新する」がこの仕様を固定している。

指摘本文を確認したところ真の脆弱性は狭く、**「同一注文の古い Pending/canceled intent も
metadata・金額・通貨が一致するため通過し、確定済み Paid を退行させられる」**ことだった
（`createStripePaymentIntent` は呼ぶたびに新しい intent を生成するため、1 注文に複数の
有効な intent が並存する）。したがって:

1. `createStripePaymentIntent` が生成した intent id を `paymentDetails` に保存（有効な intent の記録）
2. `createStripePayment` が保存済み id との一致を要求（記録の無い導入前の注文は従来どおり通す）
3. `isSettledPaymentStatus`（Paid / Refunded / PartiallyRefunded / ChargeBack）で確定状態からの
   遷移と、確定済み注文への新規 intent 作成を拒否（保存済み id の上書きによる迂回を塞ぐ）

**教訓**: CodeRabbit の指摘タイトルだけを字面適用すると設計意図を壊す。本ラウンドが
triage を挟んだ理由そのもの。

### Round 10 accepted — docs / テスト統計整合（10 件中 9 件妥当）

| # | 対象 | 判定 | 事実 | コミット |
|---|------|------|------|---------|
| CR-05 | `audit-playbook.md:34` | 妥当 | 依存監査コマンドの列挙が npm/pip/cargo のみで Bun が欠落。`bun audit` は実在し recon.md に実測証跡あり | `739097c` |
| CR-06 | `plan-template.md:27-30` | 妥当 | `git diff --stat <SHA>..HEAD` は 2 コミット間比較で**未コミット変更を検出できない**。two-dot を外し `git status --porcelain` を併用 | `739097c` |
| CR-07 | `PROGRESS.md:8` | 妥当 | 見出し `2026-06-19` に対し本文は `2026-07-17` 実測で約 1 ヶ月のズレ | `c86e9e6` |
| CR-08 | `05-phased-roadmap.md:14-22` | 妥当（自己矛盾） | 14 行「001〜012」と Phase 0 ツリー「001〜011」が矛盾。ただし plan 012 は spike で 38 行の DIRECTION-02 側に**意図的に配置**されているため、Phase 0 に足すのではなく範囲表記を実態へ合わせた | `43db4c8` |
| CR-09 | `expansion/README.md:35-37` | 妥当 | 「plans/ は昇格後は凍結」が実態と矛盾（`plans/README.md` の status 列と `ADVISOR_STATE.md` は現在も更新中）。実際の凍結対象は `plans/direction/` と `plans/audit/findings-*` のみ | `43db4c8` |
| CR-10 | `coverage-dashboard.html:2447` | **妥当（真因は別ファイル）** | JSON は `testCount: 14`、実測 17。真因は `scan-tests.ts:31` の `BLOCK_PATTERN` が `it.each` を **0 件**と数える静的走査の欠陥（`cart-checkout.test.ts:217` の `it.each` が実行時 3 ケースに展開）。rule 02/03 に従い HTML ではなく scanner を修正し 14→17 で一致 | `a1fe1bb`→`c1be6d7` |
| CR-11 | `COVERAGE_REPORT.md:14-20` | 妥当 | doc 17 vs dashboard 14 の不一致。CR-10 の修正で解消 | `c1be6d7` / `c86e9e6` |
| CR-12 | `QA_TEST_PERSPECTIVES.md:247` | 妥当 | §20 E2E 表のヘッダ基準日が `2026-07-11 R8` のままで、本文の R9（2026-07-12）追記を未反映 | `c2ad9e6` |
| CR-13 | `TESTING_DESIGN.md:31/34/81` | 妥当 | 「単一 jest.config.js を維持」「`--testPathPattern` で分ける」が実態と乖離。実際は 2 config を `--config` で分離（ADR-004）。**分割は同表 35 行「再検討のタイミング」の DB リセット条件が実際に発生した結果**であり、表だけが未更新だった | `c2ad9e6` |

### Round 10 partially rejected（誤検知の記録 — 再監査防止）

- **CR-14 `TEST_IMPLEMENTATION_PLAN.md:75-87`「E2E の『完了』表記を実測状態と分離してください」**:
  **主旨は妥当だが行番号が誤り**。指摘範囲 75-87 に `✅ 完了` は存在せず（当該範囲は R8 実測注記と
  シナリオ表）、実際の対象は **713-772 行**（3-2〜3-5 の 4 スイート）。また 889 行は既に `⚠️` で
  実装完了と実行状態を分離しており、部分的な反証があった。主旨（✅ が実行成功を含意する）は
  正当なため、実際の対象行で対応した（節冒頭に R8 実測の注記 + 見出しを「✅ 実装完了」へ）。`c2ad9e6`

> **⚠️ 本節の進捗は下の「Round 11 追記」を必ず参照すること。** 59 件のうち **25 件は
> Round 11 で処理済み**（妥当 24 件を修正 / 却下 1 件）。**残り 34 件が未着手**。
> 本節の表は「採取した 59 件の原文」を保持するアーカイブであり、進捗は反映していない。

### Round 10 deferred — plans/ 計画書 59 件（Round 11 で triage 開始）

> **永続化の理由**: 本一覧の出所はスクリーンショットのみで、GitHub にも `gh api` にも存在しない。
> セッションのコンテキストが失われると**対象そのものが復元不能**になるため、
> 採取時点（2026-07-17 / HEAD `739097c`）の「ファイル:行 → 指摘タイトル」を原文のまま台帳へ固定する。
> **行番号は採取時点のもの**であり、着手時は各ファイルの実内容へ照合し直すこと（Round 10 の CR-14 は
> CodeRabbit の行番号自体が誤っていた実例）。
> **判定は未実施**（タイトルのみ・実コード未照合）。Round 10 の CR-03 が示すとおり、
> タイトルの字面適用は設計意図を壊しうるため、Round 11 で必ず実物照合してから採否を決める。

#### 実行プラン（001-012）

| # | 対象 | 指摘タイトル（原文） |
|---|------|--------------------|
| P-01 | `plans/002-allowlist-mutable-store-fields.md` 232-245 | 評価フィールドの回帰テストも追加してください。 |
| P-02 | `plans/003-server-side-payment-and-address-trust.md` 178-190 | 所有済み住所の countryId をサーバー側の値に置き換えてください。 |
| P-03 | `plans/005-cart-integrity-atomic-save-and-persist.md` 165-178 | 永続化テストで再ハイドレーションまで検証してください。 |
| P-04 | `plans/006-place-order-double-submit-guard.md` 164-177 | 既存の place-order.test.tsx を必須の回帰テストとして扱ってください。 |
| P-05 | `plans/009-query-hygiene-bound-store-orders-and-drop-dead-query.md` 30-36 | 現行スコープのまま take を出荷しないでください。 |
| P-06 | `plans/011-onboarding-docs-env-and-stale-plan.md` 49-65 | Clerk の URL 変数の扱いを統一してください。 |

#### spike プラン（013-025）

| # | 対象 | 指摘タイトル（原文） |
|---|------|--------------------|
| P-07 | `plans/014-spike-category-attributes-facets.md` 92-103 | 調査用 psql は DATABASE_URL ではなく直接接続 URL を使ってください。 |
| P-08 | `plans/015-spike-faceted-search-and-browse.md` 94-103 | 読み取り専用調査から prisma studio を外してください。 |
| P-09 | `plans/016-spike-seller-onboarding-catalog-approval.md` 143-161 | 非公開商品の購入拒否を実装計画と完了条件に追加してください。 |
| P-10 | `plans/017-spike-recommendation-foundation.md` 111-143 | ユーザー推薦の userId を未検証の呼び出し側入力にしないでください。 |
| P-11 | `plans/018-spike-returns-rma-workflow.md` 137-152 | RMA 作成にリクエスト冪等性を追加してください。 |
| P-12 | `plans/019-spike-review-ugc-governance.md` 157-160 | トランザクションで囲むだけでは評価集計の競合を解消できません。 |
| P-13 | `plans/020-spike-promotion-engine.md` 38-48 | 法域別の要件を一次資料で裏付けてください。 |
| P-14 | `plans/021-spike-notification-foundation.md` 142-150 | 外部送信前に「送信済み」を記録しないでください。 |
| P-15 | `plans/023-bound-and-validate-public-search-pagination.md` 161-180 | FULLTEXT経路とfallback経路を分けてテストしてください。 |
| P-16 | `plans/024-validate-usercountry-cookie-write.md` 195-200 | malformed JSON時も stack を含めてください。 |
| P-17 | `plans/025-spike-rate-limit-public-endpoints.md` 115-126 | 信頼プロキシのIP導出を配備環境ごとに確定してください。 |

#### テスト実装プラン（026-041）

| # | 対象 | 指摘タイトル（原文） |
|---|------|--------------------|
| P-18 | `plans/026-unit-test-paypal-error-branches.md` 53-72 | 構造化ログ規約との不一致を明示してください。 |
| P-19 | `plans/026-unit-test-paypal-error-branches.md` 160-183 | テストケース数と完了条件を一致させてください。 |
| P-20 | `plans/027-integration-test-oversell-rollback-and-platform-coupon.md` 247-253 | PLATFORMクーポンの storeId を null に固定してください。 |
| P-21 | `plans/028-unit-test-country-query.md` 133-148 | テストデータは共通fixtureから生成してください。 |
| P-22 | `plans/029-unit-test-profile-catch-branches.md` 93-101 | 期間フィルタ追加後のテスト数条件を統一してください。 |
| P-23 | `plans/030-component-test-money-path-client.md` 231-242 | 未処理 rejection を成功するテストとして固定しないでください。 |
| P-24 | `plans/032-integration-test-webhook-payment-idempotency.md` 208-222 | トランザクションのロールバックを実証できていません。 |
| P-25 | `plans/035-integration-test-store-status-role-promotion.md` 162-180 | Clerk 側の権限昇格を未確定のまま固定しないでください。 |
| P-26 | `plans/040-integration-test-user-deletion-webhook.md` 32-45 | タイトルと実際のカスケード検証範囲が一致していません。 |
| P-27 | `plans/040-integration-test-user-deletion-webhook.md` 93-96 | SET NULL 後の SupportTicket がテスト間に残留します。 |
| P-28 | `plans/041-integration-test-coupon-code-uniqueness.md` 95-112 | Prisma の Coupon 型に合わせて日付を Date で渡してください。 |

#### E2E プラン（042-056）+ 依存プラン（057）

> **P-36 / P-37 の対象 057 は E2E ではなく `dependencies` カテゴリ**の依存 bump プラン
> （provenance は上記「plan 057 の provenance」節を参照）。本表の見出しは番号の連続で
> まとめているだけで、カテゴリの同一性を意味しない。

| # | 対象 | 指摘タイトル（原文） |
|---|------|--------------------|
| P-29 | `plans/042-e2e-signin-helper-repair.md` 183-198 | 3 秒タイムアウトを UI 形式の判定に使うと再びフレークします。 |
| P-30 | `plans/047-e2e-checkout-order-detail.md` 155-188 | 金額検算を Decimal 規約と整合させてください。 |
| P-31 | `plans/049-e2e-profile-orders-addresses.md` 87-105 | テスト間で住所状態を共有しないでください。 |
| P-32 | `plans/050-e2e-admin-store-status.md` 150-172 | HTTP 500 を成功条件として固定しないでください。 |
| P-33 | `plans/054-e2e-vrt-expansion.md` 72-79 | ベースライン更新コマンドを実際のラッパー仕様に合わせてください。 |
| P-34 | `plans/055-e2e-guest-cart-login-handoff.md` 127-147 | 新しいコンテキストへ baseURL を明示的に引き継いでください。 |
| P-35 | `plans/056-e2e-newsletter-characterization.md` 141-168 | 空メールの「POSTなし」判定が競合します。 |
| P-36 | `plans/057-upgrade-next-middleware-bypass.md` 112-124 | 16.2.xの最新パッチを取得するコマンドになっていません。 |
| P-37 | `plans/057-upgrade-next-middleware-bypass.md` 146-156 | grep -c の終了コードを修正してください。 |

#### インデックス・状態管理・direction（凍結対象を含むため要注意）

| # | 対象 | 指摘タイトル（原文） |
|---|------|--------------------|
| P-38 | `plans/ADVISOR_STATE.md` 453-465 | NEXTにP1のplan 057を反映してください。 |
| P-39 | `plans/ADVISOR_STATE.md` 512-520 | 再開プロンプトが現行Hard Ruleの例外を否定しています。 |
| P-40 | `plans/README.md` 3-9 | Round 8/9の監査履歴をヘッダーへ追加してください。 |
| P-41 | `plans/README.md` 218-225 | DEPS-08のrejected記録をplan 057と整合させてください。 |
| P-42 | `plans/audit/VETTED_FINDINGS.md` 311-339 | Round 9の依存関係とplan 057のprovenanceを同期してください。 |
| P-43 | `plans/audit/findings-14-integration-coverage-r6.md` 162-170 | Prisma の undefined 挙動を無条件に前提にしないでください。 |
| P-44 | `plans/direction/EXPANSION_BLUEPRINT.md` 84-95 | tsvector の「インデックスなし」という記述を訂正してください。 |
| P-45 | `plans/direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` 137-155 | Store.returnPolicy の決定事項を箇条書きへ戻してください。 |

> ⚠️ **P-44 / P-45 は `plans/direction/` = 凍結済みの監査原本**（本ラウンド CR-09 で凍結範囲を確定）。
> PR #153 でも同種の指摘に対し「凍結済み原本のため直接修正は不適切、対応先は昇格後の docs 側」と
> 回答済み（コメント `3596976146` / `3597151955`）。Round 11 では**同じ理由で却下**する公算が高い。
> P-42 は `plans/audit/findings-*` ではなく台帳本体（本ファイル）であり凍結対象外。

#### 日本語版プラン（plans/ja/）

| # | 対象 | 指摘タイトル（原文） |
|---|------|--------------------|
| P-46 | `plans/ja/001-scope-order-item-status-to-owned-store.md` 112-116 | Scope と Done criteria の対象ファイルを一致させてください。 |
| P-47 | `plans/ja/001-scope-order-item-status-to-owned-store.md` 160-187 | IDORテストの検証範囲を正確に記述してください。 |
| P-48 | `plans/ja/002-allowlist-mutable-store-fields.md` 110-114 | Scope と Done criteria の対象ファイルを一致させてください。 |
| P-49 | `plans/ja/002-allowlist-mutable-store-fields.md` 234-247 | averageRating と numReviews も回帰テストで明示的に拒否してください。 |
| P-50 | `plans/ja/003-server-side-payment-and-address-trust.md` 119-125 | Scope と Done criteria の対象ファイルを一致させてください。 |
| P-51 | `plans/ja/003-server-side-payment-and-address-trust.md` 157-167 | PaymentIntent の金額・通貨も注文と照合してください。 |
| P-52 | `plans/ja/003-server-side-payment-and-address-trust.md` 179-191 | 住所情報は ownedAddress から引き続き導出してください。 |
| P-53 | `plans/ja/004-upgrade-clerk-nextjs-security.md` 66-75 | 依存更新後に変更可能なファイル範囲を明確化してください。 |
| P-54 | `plans/ja/008-remove-dead-search-copy-and-relocate-schema.md` 80-85 | Scope と Done criteria の対象ファイルを一致させてください。 |
| P-55 | `plans/ja/009-query-hygiene-bound-store-orders-and-drop-dead-query.md` 85-90 | Scope と Done criteria の対象ファイルを一致させてください。 |
| P-56 | `plans/ja/009-query-hygiene-bound-store-orders-and-drop-dead-query.md` 105-123 | ページネーションなしの take: 200 を無告知で導入しないでください。 |
| P-57 | `plans/ja/010-unit-test-compute-shipping-total.md` 83-87 | Scope と Done criteria の対象ファイルを一致させてください。 |
| P-58 | `plans/ja/011-onboarding-docs-env-and-stale-plan.md` 120-123 | 旧ドキュメントへの参照検索をリポジトリ全体に広げてください。 |
| P-59 | `plans/ja/012-spike-item-level-inventory-restock.md` 161-169 | 完了条件の変更対象が矛盾しています。 |

> **P-46 / P-48 / P-50 / P-54 / P-55 / P-57 は同一パターン**（「Scope と Done criteria の対象
> ファイルを一致させてください」×6）。plans/ja/ は plans/ 直下の日本語版であり、Round 9 の
> コミット `ee80cda` / `923219d`（「in-scope file check を code commit にスコープする」）が
> plans/ 側にのみ適用され、ja 側へ伝播していない可能性が高い。Round 11 では**まとめて 1 コミット**で
> 処理できるか（rule 02 の「同一カテゴリ・3 ファイル以下・200 行未満」基準）を判断すること。

---

## Round 11 追記 — CodeRabbit ローカルレビュー triage 第2弾（2026-07-17 / HEAD `27757a3`）

> **対象**: Round 10 deferred の plans/ 計画書 59 件（上記「Round 10 deferred」節の P-01〜P-59）。
> **本ラウンドで 25 件を処理**（妥当 24 件を修正 / 却下 1 件）。**残り 34 件は未着手**（下記「Round 11 未着手」）。
> 出所・制約・注意事項は Round 10 の冒頭注記と同じ（GitHub に存在せず `gh api` で取得不可・
> 根拠はスクリーンショットの 1 行タイトルのみ・行番号は採取時点のもの）。

### Round 11 の運用で確立した判断基準（後続ラウンドはこれを踏襲すること）

1. **EN / ja はペアで扱う**。`plans/NNN-*.md` と `plans/ja/NNN-*.md` は同一プランの言語違いであり、
   同一の欠陥が両方に存在することが多い（実績: P-01/P-49、P-02/P-52、P-51、P-05/P-56、P-06/P-58）。
   片方だけ直すと翻訳ドリフトが残る。**修正時は必ず対になる版を確認**し、同一コミットにまとめる。
2. **凍結は絶対ではない**。`plans/direction/` の冒頭（OPERATIONS L13 / EXPANSION L304）は
   **(a) 参照リンクの修正 と (b) 明らかな事実誤り（引用コード・行番号・仕様の記述ミス）の訂正のみ**を
   明示的に許可している。「凍結だから全部却下」は誤り — **例外条項まで読んでから判定する**
   （実績: P-44 は事実誤りのため許可範囲内で訂正 / P-45 は体裁の問題で許可範囲外のため却下）。
3. **指摘タイトルの字面適用は設計意図を壊す**（Round 10 の CR-03 と同じ教訓）。必ず実コードへ照合する。
4. **行番号は CodeRabbit 側が誤っていることがある**（Round 10 の CR-14 実績）。指摘行に該当物が
   無い場合、主旨が妥当なら**実際の対象行を探して**対応する。

### Round 11 accepted（妥当・修正済み 24 件）

| # | 対象 | 判定根拠（要約） | コミット |
|---|------|----------------|---------|
| P-46 / P-48 / P-50 / P-54 / P-55 / P-57 | `plans/ja/{001,002,003,008,009,010}` | Scope が `plans/README.md` を含まないのに Done criteria が「対象外リストのファイルが一切変更されていない」と「README のステータス行が更新されている」を同時要求 = **両立不能**。英語版は Round 9 の `ee80cda` で修正済みだが ja へ未伝播。各ファイルを**対応する英語版と同一のパターン**へ揃えた（001/002 は Done criteria の限定のみ / 003/008/009/010 は Scope への README 追記も。010 は `ee80cda` の対象 001-009 外のため ja 側のみの不一致） | `b96e5b3` |
| P-44 | `plans/direction/EXPANSION_BLUEPRINT.md` + `docs/architecture/expansion/02-current-state.md` | 「tsvector が式評価でインデックスも無い」は**事実誤り**。GIN 式インデックス `Product_fulltext_idx` が実在（`prisma/migrations/20260222101357_init_postgresql/migration.sql:503`）。`findings-03:130` は既に「正しく裏打ち」と記録済みで、docs 側（正式版）と原本に旧主張が残存していた。**凍結の許可範囲 (b) に該当**するため原本も訂正 | `39da9b6` |
| P-38 | `plans/ADVISOR_STATE.md` | NEXT が 051/056 のみで **P1 の 057 を落としていた**。`README.md:103` の Status 表は 057 を「P1 / 依存ゼロ / TODO」、同 140-146 は「テスト系プラン群より優先する」と明記しており矛盾 | `731a254` |
| P-39 | `plans/ADVISOR_STATE.md` | 再開プロンプトの「ソースコード変更禁止」が Hard Rule 1 の **execute バリアント例外**（executor サブエージェントが隔離 worktree でコードを編集）を否定。`07ec68b` が Rule 1 を純化した際の取り残し。なお「plans/ のみをコミット」は Hard Rule 2 の "Landing any of it on the user's branch stays the user's decision" に該当するユーザー指示のため**矛盾扱いせず現状維持** | `731a254` |
| P-40 | `plans/README.md` | ヘッダーの監査履歴が Round 7 で停止。Round 8（HEAD `fbd1020`）/ Round 9（HEAD `25e50d9`）を追記 | `9cca76a` |
| P-41 | `plans/README.md` | **実害のある矛盾**。rejected 記録「DEPS-08 Next.js 16.2.1: already current — no action」は Round 1（`f9752c0` / 2026-07-03、advisory 未公表時）の判断だが、plan 057 は同じ `next@16.2.1` を HIGH（GHSA-26hh-7cqf-hhc6）として P1 bump を要求。**読者が 057 を「再監査済みの却下事項」と誤認して脆弱性対応を握り潰す危険** | `9cca76a` |
| P-42 | `plans/audit/VETTED_FINDINGS.md` | Round 9 のプラン化は 051-056（TESTS-39〜44）のみで、**057 の provenance がどのラウンドにも存在しなかった**。057 は依存監査由来の独立プラン（`7f7bb71`）でカテゴリも `dependencies`。recon の `bun audit` 証跡表・「監査後の変化」表が `next` を含まない理由（監査時点で advisory 未公表）も記録。あわせて Round 10 の列挙で 057 を「E2E プラン」に分類していた**自らの誤り**も訂正 | `9cca76a` |
| P-43 | `plans/audit/findings-14-integration-coverage-r6.md` | 「`undefined` は Prisma が条件ごと無視する」を**無条件の前提**にしていた。現行 `prisma@5.22.0`（`strictUndefinedChecks` 未有効）では成立するが、DEPS-04 の Prisma 5→6 移行で前提が変わりうる。キー自体を条件付きで生やす形へ改めバージョン非依存にした | `9cca76a` |
| P-01 / P-49 | `plans/002` + `plans/ja/002` | プランの Current state（L23）が `averageRating` / `numReviews` を特権カラムと明示し "fake their rating" を塞ぐべき攻撃に挙げながら、**Step 5 の回帰テストは `status` / `featured` しか assert していない** = 自ら定義した脅威に回帰網が無い。`3247e42` が `applySeller` create 側のみ assert 済みで、`upsertStore` の update/create 2 経路が未カバー | `d036f53` |
| P-02 / P-52 | `plans/003` + `plans/ja/003` | **誤った安全性の主張**。「所有権が証明された今は既存の `shippingAddress.countryId` でも許容できる」は誤り — 所有権チェックは `{ id, userId }` の一致しか見ず、クライアント供給オブジェクトの他フィールドは無保証。自分の住所 id と偽装 `countryId` で通過でき、`countryId` は `getDeliveryDetailsForStoreByCountry` を駆動するため**配送料改ざんが開いたまま**。実装は既に `user.ts:509-511` で `ownedAddress.countryId` を使用しており、プランのみが取り残されていた | `d1493a4` |
| P-51 | `plans/003` + `plans/ja/003` | 「amount / currency / status は Stripe 権威になる」で停止し**注文との突き合わせが無い**。Stripe 権威であることと `order.total` と一致することは別問題。amount/currency 照合と、`toStripeAmount` が作成時と同一の Decimal ヘルパーである必要を追記。Round 10 (CR-03) 実装済みの有効 intent 一致確認・確定状態ガードも参照させた | `d1493a4` |
| P-03 | `plans/005` | 永続化テストが「保存された形が persist ラッパーである」ことしか見ておらず、これは**シリアライズ形のプロキシ**。真の不変条件は「書いたものが読み戻せる」こと（version 不一致・キー改名・`partialize` の脱落があれば shape 検証は通ったまま rehydrate が壊れ、**テスト緑のままカートが消える**）。`persist.rehydrate()` の往復検証と、`totalItems` / `totalPrice` の再計算 assert を必須化 | `ebef82d` |
| P-04 | `plans/006` | 「この領域にコンポーネントテストが無ければ scaffold せず手動確認」という条件分岐が残存。**`src/components/store/cards/place-order.test.tsx` は現に存在**し mock 一式も揃っているため、回帰テストは必須。条件分岐を削除し Test plan を実在ケースに合わせて確定 | `ebef82d` |
| P-05 / P-56 | `plans/009` + `plans/ja/009` | **プランの自己矛盾**。behavior-change caveat が「seller ページは『最新 N 件を表示中』の告知を必ず出せ」と義務付ける一方、In scope に**その UI ファイルが無い**（store.ts / browse/page.tsx / store.test.ts / README のみ）= スコープ内で義務を果たせず、素の `take` 出荷は caveat 自身が禁じるサイレント切り捨てになる。`src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx`（`getStoreOrders` の唯一の呼び出し元）を Scope へ追加。ja 版には caveat ブロック自体が欠落していたため EN 同等に補った | `b4545b7` |
| P-06 | `plans/011` + `plans/ja/011` | Clerk URL 変数が同一プラン内で**3 通りに扱われていた**（superset は「必須」に含める / 「README に不足」リストは除外 / `.env.example` テンプレートは「必要に応じて」とコメントアウト）。加えて `.env.docker.example:28` の `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` がどこにも出てこない。実測で `src/` は 3 変数とも未参照（grep 0 件）= Clerk がライブラリ設定として読むだけで**任意**。ただし本リポジトリは `src/app/(auth)/` にカスタム認証ページを持ち値は確定。「既定値ありの任意」で 3 箇所を統一 | `27757a3` |
| P-58 | `plans/011` + `plans/ja/011` | **指摘が実測で実証された**。修正手順の検索範囲（`docs/ README.md .claude/ specs/`）が検証コマンド（リポジトリ全体）より狭く、範囲外の参照は修正を免れたままゲートだけが落ちる。実測: `plans/` に約 15 件（`ADVISOR_STATE.md` / `audit/recon.md` / `audit/findings-07` / `audit/VETTED_FINDINGS.md` / 本プラン EN・ja 自身）、`docs/design/*/README.md` に約 11 件。修正・検証とも全リポジトリ検索へ統一 | `27757a3` |

### Round 11 rejected（再監査防止）

- **P-45 `plans/direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` 137-155「`Store.returnPolicy` の決定事項を箇条書きへ戻してください」**:
  **却下 — 凍結の許可範囲外**。指摘自体は構造欠陥として正しい（`（期間・対象外カテゴリ。`Store.returnPolicy String` の構造化を含む）` が
  「決めるべきこと」の「返品ポリシーのデータ化」に係る括弧書きなのに、間に `TODO(needs-detail)` の
  blockquote が挿入されて親項目から切り離されている）。しかし本ファイルは凍結済み原本で、
  許可されるのは **(a) 参照リンクの修正 / (b) 明らかな事実誤りの訂正のみ**（L13 / L263）。
  体裁の崩れはどちらにも該当しない。**かつ昇格先の正式版
  [`docs/architecture/expansion/04-architecture-pillars.md:77-79`](../../docs/architecture/expansion/04-architecture-pillars.md)
  は既に正しく整形されている**（括弧書きが親項目に直接続く）ため、下流への実害もない。

### Round 11 未着手（34 件）→ **Round 12 で全件処理済み**

> ✅ **本表は解消済み**。下記 34 件はすべて「Round 12 追記」節で triage 済み
> （accepted 30 / rejected 4）。**未着手はゼロ**。以下は経緯の記録として残す。

| 群 | 項目 | 件数 | 参照節 | Round 12 の結果 |
|---|------|-----|-------|----------------|
| spike プラン | **P-07〜P-17** | 11 | 「spike プラン（013-025）」 | 全 11 件 accepted |
| テスト実装プラン | **P-18〜P-28** | 11 | 「テスト実装プラン（026-041）」 | 9 件 accepted / **P-27・P-28 rejected**（誤検知） |
| E2E プラン | **P-29〜P-37** | 9 | 「E2E プラン（042-056）+ 依存プラン（057）」 | 7 件 accepted / **P-30・P-34 rejected**（既充足・誤検知） |
| ja 個別 | **P-47**（ja/001 IDOR テストの検証範囲）/ **P-53**（ja/004 依存更新後の変更可能ファイル範囲）/ **P-59**（ja/012 完了条件の矛盾） | 3 | 「日本語版プラン（plans/ja/）」 | 全 3 件 accepted（いずれも翻訳ドリフト。P-47 は EN 側にも同一欠陥） |

**注意点（着手前に読むこと）**:
- **P-12（019 の評価集計競合）・P-14（021 の送信前記録）・P-13（020 の法域要件）は設計判断**を含む。
  spike プランは「決めるべきこと」を列挙する検討ドキュメントであり、**決定を書き込む先は spike の
  成果物側**（Round 3 の凍結注記が「本ファイルの『決めるべきこと』を決定事項で書き換えないこと」と
  規定しているのと同型の注意）。プランの記述矛盾の修正と、未確定の設計判断の確定を混同しないこと。
- **P-36 / P-37 の対象 057 は E2E ではなく `dependencies`**（provenance は上記「plan 057 の provenance」節）。
- ja 側にペアが存在する項目は EN と同時に確認すること（上記「Round 11 の運用で確立した判断基準」1）。

---

## Round 12 追記 — CodeRabbit ローカルレビュー triage 第3弾（2026-07-17 / HEAD `3a875cd`）

> **対象**: Round 11 未着手の 34 件（spike P-07〜P-17 / テスト実装 P-18〜P-28 /
> E2E・依存 P-29〜P-37 / ja 個別 P-47・P-53・P-59）。**これで 73 件すべての triage が完了**。
> **本ラウンドの結果**: **accepted 30 / rejected 4**（30 + 4 = 34 で対象件数と一致）。
> rejected は **P-27・P-28・P-30・P-34** の 4 件（内訳は下記「Round 12 rejected」節。
> P-34 は当初 accepted 候補だったが、実測検証の結果 誤検知と確定して rejected へ移した）。
> 出所・制約は Round 10 の冒頭注記と同じ（GitHub に存在せず `gh api` 不可・根拠は
> スクリーンショットの 1 行タイトルのみ・行番号は採取時点）。
> **`src/` は 1 行も変更していない**（全 27 コミットが `plans/` 配下のみ）ため、テスト数は
> 変動せず `spec-sync-after-test` は不要（rule 02 の MUST 条件に非該当）。`bunx tsc --noEmit` exit 0。

### Round 12 で追加された判断基準（Round 11 の 4 点に加えて踏襲すること）

5. **「記録」と「契約」を混同しない**。characterization テストで現状の欠陥を可視化する意図は
   正しいが、**欠陥そのものを assert して緑にすると誘因が反転する**（バグがある間は緑・修正すると赤 =
   修正を罰する「欠陥のロック」）。固定するのは**あるべき挙動**にし、未実装の間は
   `it.failing`（Jest 28+）/ `test.fail()`（Playwright）でマークするか、
   `not.toBe(200)` のように**修正後も生き残る耐久契約**へ言い換える。現状の事実はコメントと
   Maintenance notes に記録すれば足りる（実績: P-23 / P-32）。
6. **「起きないこと」の assert には control（対照）を添える**。「副作用が無い」「POST が飛ばない」
   「表示されない」は、**そもそも仕組みが動いていなくても緑になる**。対になる肯定側
   （制約なしなら 1 件書かれる / 有効入力なら POST が飛ぶ / BAN 前は 200 で表示される）を
   先に通してはじめて、否定側の assert が意味を持つ（実績: P-24 / P-32 / P-35）。
7. **却下する前に実測する**。「通説」で判断しない。P-34 は Playwright の
   `browser.newContext()` が `use.baseURL` を継承しないという通説に見えたが、実測（baseURL
   有無で相対 `goto` の挙動が変わる）と実装（`playwright/lib/index.js:207-222` が
   `_defaultContextOptions` へ注入）の両方で**継承する**ことを確認して却下した。
   P-28 も生成型（`startDate: string`）を見なければ誤修正していた。
8. **指摘が既に解消済みのことがある**。ローカルレビューは未プッシュのコミット群を対象とするが、
   **同じ範囲の後続コミットが既に直している**場合がある（P-30 は `612bb93`
   「verify money in integer cents」で採取時点より前に解消済みだった）。
   「現在の内容」と照合すること。

### Round 12 accepted（妥当・修正済み 30 件）

| # | 対象 | 判定根拠（要約） | コミット |
|---|------|----------------|---------|
| P-07 / P-08 | `plans/014` + `plans/015` | 「読み取り専用調査」表のコマンドが実行不能・副作用つき。`psql "$DATABASE_URL"` は **Accelerate の `prisma://` URL** で psql が接続できない（`docs/migration/05-postgres-migration-steps.md:23`。素の接続文字列は `DIRECT_URL` = `schema.prisma:9` の `directUrl`、リポジトリ内の psql 前例 :168/:301 も `$DIRECT_URL`）。015 の `prisma studio` は書き込み可能な GUI で見出しと矛盾し、014 は既に「使わない」と明記済み = 姉妹プラン間の不整合 | `6006063` |
| P-09 | `plans/016` | Open question 3 の blockquote が **(i) ブラウズ用公開スコープ / (ii) チェックアウトの購入可能性チェック**の 2 系統を課すのに、Step 4・Verify・Done criteria が (i) しか要求せず **(ii) がスコープから落ちていた**。可視性フィルタは認可の代用にならず、非 ACTIVE 品は直リンク・カート残留・API 直叩きで**購入が通ったまま**になる。拒否は `placeOrder`（`user.ts:424`）のサーバー側で行うことを明記 | `9eb8066` |
| P-10 | `plans/017` | seam は `src/queries/` = `"use server"` 配置であり**引数はクライアント任意入力**。`{ anchor:"user"; userId: string }` は他人の ID を渡すだけで wishlist/注文由来の推薦を読める **IDOR**。直下のキャッシュ分離規定は cross-user のキャッシュ漏れしか防がず引数経由の攻撃は素通り。`userId` を型から外し `requireUser()`（`auth-guards.ts:30` — 引数を取らずセッションから導出）で導出させた | `be0320d` |
| P-11 | `plans/018` | 冪等性が**遷移側だけ**（「条件付き updateMany」）で**作成（INSERT）側が無防備**。Q1 の数量上限は*合計*を縛るだけで、3 個購入 → 「1 個返品」の二度押しは 1+1=2 ≤ 3 で両方通り二重返金を招く（TOCTOU の原子化でも救えない — 両方が不変条件を満たすため）。要件のみ Q1 へ追加し方式選択は spike に残した | `3e11945` |
| P-12 | `plans/019` | **技術的事実の誤り**。プラン全体（L81 / Q4 / Step 3 / Maintenance）が評価集計の競合を「`$transaction` 化」で解決できるかのように書くが、tx が与えるのは**原子性であって分離性ではない**。既定の READ COMMITTED では findMany → 再計算 → update の read-modify-write がロストアップデートを起こし、**両方 commit に成功するため検知もできない**。実装側は既に `user.ts:286` で `isolationLevel: Serializable` を明示済み（CR-04 由来）。方式 (a)/(b)/(c) の選択は spike の設計判断として踏み込まず、前提の訂正と「分離レベル / ロック機構の確定」要求に留めた | `9d80ad6` |
| P-13 | `plans/020` | 法域別要件が**出典なしの断定**（「EU: 直近 30 日間の最低価格を提示する義務」等）で、Done criteria にも裏付け要求が無い。「30 日」は**価格履歴の保持期間というスキーマ要件を直接駆動する数値**で、誤れば法令非対応か過剰実装に直結。法域の**選択**は spike の判断のため踏み込まず、①未検証の初期仮説と明示 ②一次資料での裏付けと出典明記の要求 ③調査の出発点（EU: Directive (EU) 2019/2161 / US: 16 CFR Part 233 / 日本: 景表法 5 条 2 号 + 消費者庁ガイドライン。いずれも未検証と断り書き）④裏付けまで数値をスキーマ要件へ落とさない ⑤法務判断が要る場合の STOP を追加 | `345583e` |
| P-14 | `plans/021` | **同一文内の自己矛盾**。「送信側も **at-least-once 前提**で重複耐性を持たせる（…／**送信済みフラグを立ててから送る**）」—— 前者は「重複しても失わない」保証だが、後者は at-most-once の挙動で、送信失敗やクラッシュ時に**送っていないのに送信済みと記録された通知が永久に再送されない**（サイレントロス）。方式選択は spike に残し、誤指示の除去と選択肢（送信後に記録 / リース方式）の提示に留めた。あわせて outbox の参照先を Q6（opt-out）→ **Q4（送信の実行モデル）**へ訂正（(β) outbox は plan 018 の Q6 で、021 では Q4 の (b)） | `3791a51` |
| P-15 | `plans/023` | **実測で実証**。Current state 自身が「`take: limit` は GET の**2 箇所**（FULLTEXT / contains fallback）に流れる」と書くのに Step 2 のケース 1〜5 が経路を指定していない。route は既に `7f2365e` で実装済みで、`route.test.ts` の正規化 5 ケースは全て `mockProductFindMany.mockResolvedValueOnce([])` で **FULLTEXT 経路のみ**を通し、**fallback（`route.ts:332`）の take/skip は一度も検証されていない**。fallback 側のクランプ漏れは「FULLTEXT が落ちた時だけ発現する」最も気づきにくい形で残る。経路別の必須ケースと Done criteria の件数分解を追加 | `b774660` |
| P-16 | `plans/024` | 同一プラン内の不整合。L111-113 が tech.md 構造化ログ規約を**自ら引用**し「第2引数は `{ error, stack }` の 2 引数形式」と明記し、L179 も「境界で構造化ログ」を要求、50 行下の cookie 失敗ブランチ（L246-249）は `stack` を含むのに、**malformed JSON ブランチ（L197）だけが `stack` を落としていた**。規約を引用しながらコード例がそれを破っており、実装されると JSON パース失敗の発生源が追えない | `a9318e6` |
| P-17 | `plans/025` | 信頼プロキシからの client IP 導出は**配備トポロジーの関数**なのに Vercel 前提で一本化。その前提自体が未検証で、Current state L64 が "Vercel-style serverless **assumed**" と自認し、実測では `vercel.json` 無し・README はアプリのホスト先を宣言せず（Neon = DB のみ）・自前 Docker スタック同梱。正解はホスト毎に異なり（Vercel / CDN・WAF 固有ヘッダ / 逆プロキシ無しでは `x-forwarded-for` は不在か完全に攻撃者制御）、誤ると**両方向に壊れる**（信頼しすぎ = 攻撃者にキーを渡す / 信頼しなさすぎ = 全員が同一バケットで正規ユーザーを締め出す）。配備先の確定を先行させ、trust boundary を環境別に確定させる形へ | `5dfa538` |
| P-18 / P-19 | `plans/026` | **(P-18)** Why が「paypal.ts は tech.md が構造化ログ規約の**実装例として指名**しているファイルであり、その**規約遵守**がテストで固定されていないのは不健全」と書くが、**実物は規約に準拠していない** —— tech.md は 2 引数形式 `{ error, stack }` を定めるのに `paypal.ts:26-31` は**3 引数の位置指定形式**。**規約が自ら挙げた模範例が規約に違反している**。characterization プランなので、この前提のままでは「規約遵守を固定した」つもりで**規約違反を固定**する。Risk の「paypal.ts は 1 行も変更しない」制約は維持し**乖離の明示**に留めた。**(P-19)** 件数が 5 箇所で揺れ（見出し「8 ケース」/ Verify「7〜8」/「31〜32」/ Done「31 以上」）、発生源はケース 8 の「（ケース 2 の assert に同居可）」。独立テストに確定させ **17+8+7=32** で統一 | `b849123` |
| P-20 | `plans/027` | Step 4 の `storeId: <どちらでも可>` を `null` に固定。決め手は**テストの識別力**: `user.ts:671` の判定は論理和 `isPlatformCoupon \|\| (storeId === cartCoupon?.storeId && cartCouponValid)` で、店舗 X を入れると**X への割引は 2 項のどちらからでも到達でき**「PLATFORM 分岐が効いた」ことを証明できない。`null` ならどの店舗とも一致せず**経路が `isPlatformCoupon` に一意化**する。加えて ①PLATFORM は特定店舗に所有されず実装も PLATFORM 時は `storeId` を参照しない（:671 短絡 / :1153-1155 全件対象）②`Coupon.store` は `onDelete: Cascade` で店舗削除の巻き添えになる。実装前提として `SeedCouponInput.storeId: string`（必須・非 null）では `null` を渡せないため `string \| null` への緩和を Scope / Step 1 に追加（DB 側は `String?` で元から null 可） | `e241f01` |
| P-21 | `plans/028` | 正常系がテストデータをインラインリテラルで手書き。`createMockCountry`（`test-fixtures.ts:693`）が既に存在し `{ id, name: "Japan", code: "JP", createdAt, updatedAt }` を返す（手書き値とほぼ同一）。型安全ファクトリの利用は CLAUDE.md「共通テストインフラ」の規約で、028 は `src/config` を一度も参照していなかった。害は `as` キャストに現れている —— リテラルは `createdAt`/`updatedAt` を欠いて型エラーになり、それを `as` で黙らせている。キャストで潰すと将来 `Country` に列が増えてもテストは古い形のまま緑で通り続ける | `befedf9` |
| P-22 | `plans/029` | 件数が 4 箇所で不一致（Effort「+14〜20」/ Commands「34 → 54」= Step 1 後の値で Step 2 の追加を無視 / Step 2 Verify に数値なし / Done「54 以上」）。根本原因は **Step 1 と Step 2 の正面衝突** —— Step 1 は「必要テスト数は機械的に定義する（lcov の実測任せ・『間引いてよい』を排除する）」と定めるのに、Step 2 は「lcov の未カバーが 8 行なので**既にカバー済みの期間値はスキップしてよい**」と Step 1 が明示的に禁じた手法を採り、テスト数が lcov 依存の非決定になっていた。Step 1 の原則を Step 2 へ適用し 3 関数 × 3 期間 = 9 に固定（行カバレッジは「その行を通ったか」しか見ず、境界計算の誤りは期間値ごとに独立して起きる）。**34+20+9=63** で統一 | `0f819f1` |
| P-23 | `plans/030` | hydrate の reject が unhandled になる場合に「**未ハンドルであること**」を assert して固定する案だった。誘因が反転する（バグがある間は緑・catch を実装した瞬間に赤 = 修正を罰する）。固定の向きだけを変え、常に**望ましい挙動**（catch され `toast.error` 等でユーザーに伝わる）を assert 対象にし、未実装の間は `it.failing`（Jest 30 使用。`it.failing` は Jest 28+）でマークする形へ。`process.on("unhandledRejection")` での固定も除去（Node/Jest 設定依存でフレークし他テストの rejection も拾う） | `e66b81a` |
| P-24 | `plans/032` | S5 の手法が**原子性を何も証明しない**。`PaymentDetails.orderId` は Order への**必須 FK**（`onDelete: Cascade`）なので、① Order を消すと Cascade で既存 PaymentDetails も道連れ ② Order が無ければ `paymentDetails.upsert` 自体が FK 違反で落ちる = 「upsert は成立するが order.update だけ失敗する」状態は**存在し得ない** ③ つまり失敗するのは**2 番目ではなく 1 番目**で、`count === 0` は **`$transaction` が無くても成立**し「ロールバックされた」と「そもそも書かれなかった」を区別できない。実 PG で `order.update` が書く `paymentMethod: "Stripe"` を拒む CHECK 制約を一時付与する方式へ差し替え（`IS DISTINCT FROM` で既存 NULL 行でも制約追加が通る / DROP は `finally` 必須 / **対照 assert = 制約なしでは count === 1** を必須化）。route が実際に tx で括られていること（`stripe/route.ts:153-179`）も実測して明記 | `78ffa81` |
| P-25 | `plans/035` | 非対称が仕様かバグか未確定と認めつつ、fallback が「判定が得られない場合はコメントを明記して**進める**」を許していた。実コード照合で**権限付与**の非対称と判明: DB 昇格は `store.status === "PENDING" && updated.status === "ACTIVE"` で PENDING 起点のみ / Clerk 同期は `updatedStore.status === "ACTIVE"` で**任意の起点**から。そして認可ソースは **Clerk の `privateMetadata.role`**（`auth-guards.ts:71` の `requireSeller`）であって DB の `User.role` ではない。つまり DISABLED → ACTIVE で **DB が USER のままでも `requireSeller()` が通り実際に販売者権限が付与される**。バグならテストが権限昇格を契約として固着させる（コメントは固定を防がない — assert こそが契約）。fallback を STOP へ差し替え | `2b4ae2c` |
| P-26 | `plans/040` | タイトルが「FK 連鎖（RESTRICT / CASCADE / SET NULL）を固定する」と掲げ Why が CASCADE 群に 7 種を列挙するのに、シナリオ 1 は Cart/CartItem/Wishlist/フォローのみ。実物照合で 2 点判明: ① **PaymentDetails の CASCADE は到達不能** —— `PaymentDetails.orderId` は必須 FK なので保有者は必ず Order を持ち `Order.userId` は RESTRICT、削除は常に Order で阻止される（シナリオ 2 の 500 経路に吸収）= CASCADE 群への列挙は事実誤り ② **`Conversation.orderId` は optional** なので Order 無しで成立し、Conversation / Message / `_CouponToUser` の CASCADE は**到達可能なのに未検証**。シナリオ 1 に seed と assert を追加（`_CouponToUser` は implicit M2M のためフォロー同様 Coupon 側から `_count.users` を引く）。`seedCoupon` の `connectUserIds` と生 `db.*.create` で足り「seed.ts / reset-db.ts を変更しない」制約は維持 | `d94d00e` |
| P-29 | `plans/042` | 修復後の helper が **3 秒 timeout 付き `waitFor` の `.then(true)/.catch(false)`** で 1 段 / 2 段 UI を判定 = **タイムアウトを機能検出に使う**アンチパターン。遅い CI・コールドスタートで描画が閾値を超えると 2 段分岐が**空パスワードのまま Continue を押して**サインインが失敗し、**閾値付近でのみ再現する**最悪のフレークになる —— 本プランがまさに撲滅対象にしている不安定さを修復コード自身が再導入する。UI 形式は Clerk の**設定で決まる静的な性質**（現行が 1 段であることは Why で実測確定済み）なので、分岐を外し `expect(passwordInput).toBeVisible()` で assert する形へ。待ち時間は描画待ちにのみ使い判定には使わない | `0aa2350` |
| P-31 | `plans/049` | 注文には「他テストが作った注文と同居しうる — workers:1 でも DB は共有」と明記して行スコープを徹底しているのに、**住所には同じ規律が無い**。テスト 1 は UI で住所を作るが後始末が無く、実行ごとに累積して 2 回目以降は assert が strict mode violation になる。またテスト 2 のチェックアウトの住所選択が**実行順に依存**する。さらに後始末の前提が誤り —— 「カスケードクリーンアップ」と書くが `ShippingAddress.userId` は **RESTRICT** でカスケードは存在せず、むしろ住所が残ると `user.delete` が P2003 で失敗し、`auth.ts:124-138` の `cleanup()` が `.catch(() => {})` で**その失敗を握り潰す**（片付いていないのに片付いた顔をする）。参照元 `stock-decrement.spec.ts:96-106` は実際にはカスケードではなく `shippingAddress.deleteMany` で明示的に消しており、プランがパターンを誤って要約していた | `c28305a` |
| P-32 | `plans/050` | `toBe(500)` で未処理例外のステータスを期待値に固定（Current state / Done criteria / STOP にも波及）。① **誘因の反転**（500 は仕様でなくバグ。404 へ直すと赤）② **偽の安心** —— 500 は「何かが壊れた」としか言わず、DB 断や無関係なリグレッションでも 500 になり、そのときエラーページには店舗名が無いので `toHaveCount(0)` も**一緒に通る** = 2 つの assert が揃って緑でも「BANNED にしたから見えない」ことを何も証明しない。`not.toBe(200)` へ変更（500 でも 404 でも通る耐久契約）し、既存の手順 2 を **control として必須化**（BAN 前に 200 + 店舗名 visible）。500 の事実はコメントと Maintenance notes に記録 | `530e3c6` |
| P-33 | `plans/054` | ベースライン撮影が `... --project=chromium -- --update-snapshots` と区切りの `--` を挟んでいた。`run-local.sh` の最終行は `bunx playwright test --retries=2 "$@"` で**引数をそのまま渡す**。`--` は `bun run test:e2e:local -- <args>` のように **`bun run` 経由**でだけ必要な作法（`package.json:13`）で、`bash` で直接叩く本プランでは不要。渡すと playwright は `--` 以降を**位置引数（テストフィルタ）**と解釈し `--update-snapshots` という名前のテストを探して **0 件マッチ** = ベースラインが更新されないまま成功に見える。併記の「引数をそのまま渡さない場合は」という但し書きも誤診のため削除。プラン内の他 4 箇所は元から `--` 無しで正しかった | `b345ff2` |
| P-35 | `plans/056` | 空メールの「POST なし」判定が競合。`checkValidity()` は validity 状態を**問い合わせるだけの純粋関数**で、空の `required` 欄なら **click の前でも後でも常に `false`** を返すため「submit がブロックされた」証拠にならず、`expect.poll(...).toBe(false)` は**初回評価で即成立して何も待たない**。直後の `toHaveLength(0)` が**まだ発火していないだけの POST を「無かった」と誤判定**しうる。**実ブラウザで検証**（`setContent` の最小フォーム）: click 前は `checkValidity()=false` かつ `invalid` 未発火 / click 後に `invalid` 発火・submit ハンドラ未実行。判定を `invalid` イベント（submit 試行時の制約検証失敗でのみ発火）へ差し替え。`window` フラグは `any` を使わず型付け。テスト 1 が `page.on("request")` 捕捉の control を兼ねる旨も明記 | `b4bf5cb` |
| P-36 / P-37 | `plans/057` | **(P-36)** 「Confirm the latest 16.2.x」と書きつつ `bun info next version` = **最新リリース全体**を返すコマンド。実測では両方 `16.2.10` で**偶然一致するだけ**であり、16.3.0 / 17.x が出た瞬間にそれを返す —— この手順が最も効くべきタイミングで静かに誤答し、Scope と STOP が**明示的に禁じる**マイナー/メジャー移行へ誘導する。`npm view "next@16.2" version \| tail -1` へ差し替え（16.2 レンジを解決し昇順出力することを実測確認）。**(P-37)** `grep -c "<id>"  # expect 0` は**終了コードが検証内容と逆** —— grep は該当なしで exit 1 を返すため望ましい結果が失敗終了になる（実測: `echo hello \| grep -c nomatch` は `0` を出力し exit 1）。`grep -q` の明示分岐ループへ置換（cleared なら exit 0 / 残存なら該当 id を示して exit 1、`bun audit` は 3 回→1 回）。capture の `\|\| true` は必須（`bun audit` は advisory が残ると非ゼロ終了し、ここでは handlebars CRITICAL が残る前提）。**置換後のスクリプトを実行して検証済み** | `73209af` |
| P-47 | `plans/001` + `plans/ja/001` | 3 階層 IDOR を満たすと宣言しつつ **(c) を「`updateMany` が `{ count: 0 }` を返す経路で throw する」と説明** = (a) スロー検証の言い換えであり副作用の検証になっておらず、例示コードにも (c) の assert が無い（実際は (a)(b) の 2 階層のみ）。`updateMany` は**モックなのでそもそも何も書かない**ので、戻り値を `{count:0}` にして throw を確認しても副作用の不在は示せない。`SECURITY_GAP_REPORT.md:114` の (c) は「ガード失敗時に下流の `upsert`/`create`/`delete`/関連 `findMany` が呼ばれないこと」=**別の呼び出しの不在**を見る階層。本関数は Step 1 でスコープ無しの `update` → スコープ付き `updateMany` へ移行するため **`update` の非呼び出し**がまさに検証対象（将来 `update` へ戻す変更を検知）。`mockDb.orderItem` は両方を宣言済み（`order.test.ts:49-53`）でモック追加は不要。**EN 側にも同一の欠陥があり同一コミットで修正**（基準 1） | `de23c75` |
| P-53 | `plans/ja/004` | Scope「対象内」が `plans/README.md` を含まないのに Done criteria が「`git status` は package.json + bun.lock のみ」と「README のステータス行が更新されている」を同時要求 = **両立不能**（Round 11 `b96e5b3` と同一パターン）。英語版は正しく、Scope に README を含み Done criteria が「**bump コミットの直前**は…」「**別の docs コミット**で」と**時点を限定**していたが、ja 版でこの限定が翻訳時に落ちていた。**漏れの経緯**: EN 側の一括修正 `ee80cda` は対象が 001-003 / 005-009 で **004 を含まず**、ja 側の `b96e5b3` はその 6 件を伝播しただけのため 004 は両方の網から外れていた | `bc4ae23` |
| P-59 | `plans/ja/012` | Done criteria が両立不能 —— 「`git status` は**新規** docs/plan ファイルのみ」と「`plans/README.md` のステータス行が更新されている」（README は既存ファイルの変更）。英語版は `git status` の条件に **"plus the `plans/README.md` index update below"** の但し書きを持ち整合しており、ja 版でこれが翻訳時に落ちていた。**Scope はいじらない** —— EN/ja とも Scope に README を挙げず Done criteria の但し書きで整合を取る設計で、ja だけ Scope を変えると逆に英語版とドリフトするため | `3a875cd` |

### Round 12 rejected（再監査防止 — 4 件）

- **P-27 `plans/040` 93-96「SET NULL 後の SupportTicket がテスト間に残留します」**:
  **却下 — 誤検知**。プランの既存注記（採取時点の L93-96）が正しい。`reset-db.ts:78` は
  `TRUNCATE TABLE ... RESTART IDENTITY **CASCADE**` を発行し、PostgreSQL の `TRUNCATE ... CASCADE` は
  **named table を FK 参照しているテーブルを自動的に truncate 対象へ加える**（判定は **FK 制約の有無**であって
  行の値ではない）。`SupportTicket.userId` は `User` への FK（SET NULL）で `User` は `APPLICATION_TABLES` に
  列挙済み（`reset-db.ts:50`）のため、**匿名化済み（`userId=NULL`）の行も truncate される**。
  SET NULL であることは cascade 判定に影響しない。そもそも CASCADE 無しでは「他テーブルから FK 参照されている
  テーブルは truncate できない」とエラーになるため、CASCADE はまさにその依存を取り込むための指定。
  Conversation / Message も同じ理由で掃除される。

- **P-28 `plans/041` 95-112「Prisma の Coupon 型に合わせて日付を Date で渡してください」**:
  **却下 — 誤検知（字面適用すると型エラーになる）**。Round 10 の CR-03 と同型の罠。
  `Coupon.startDate` / `endDate` は **`String`** である（`schema.prisma` の `startDate String` /
  `endDate String`、生成型も `startDate: string`（`node_modules/.prisma/client/index.d.ts:31112`））。
  `Date` なのは `createdAt` / `updatedAt` のみ。プランの `buildCouponInput` は
  `startDate: new Date(...).toISOString()`（string）/ `createdAt: new Date()`（Date）と**既に正しい**。
  指摘どおり `startDate: new Date(...)` にすると **Date は string に代入できず型エラー**になる。
  混乱の元は同一モデル内の型の混在で、plan 020 も「日付が文字列型（TZ・比較の保証なし）」を
  **設計上の欠陥として**挙げている（是正は別課題であってテストプランの範囲外）。

- **P-30 `plans/047` 155-188「金額検算を Decimal 規約と整合させてください」**:
  **却下 — 既に充足済み**。採取時点（`739097c`）で既にセント整数検算へ修正済みだった
  （`612bb93` "fix 047 (declare doc-sync scope, **verify money in integer cents**, …)" が
  `< 0.02` の許容誤差方式を置換。同コミットは **origin/dev にプッシュ済みかつ採取時点より前**）。
  現行プランは L170 で 1 度だけ丸めてセント整数化し、L181-188 で許容誤差を明示的に拒否
  （「±0.01〜0.02 は誤差を隠すと同時に 1 セントの実バグも見逃す」）、L234 の Done criteria で
  float 比較を禁止、L264-268 で `group-table.tsx` の Decimal 逸脱と「本 spec の検算はこのズレの
  影響を受けない」理由まで文書化済み。**ローカルレビューは未プッシュ範囲を対象とするが、
  指摘が既に解消済みの内容を指すことがある**（Round 12 の判断基準 8）。

- **P-34 `plans/055` 127-147「新しいコンテキストへ baseURL を明示的に引き継いでください」**:
  **却下 — 誤検知（実測とソースの両方で確認）**。「`browser.newContext()` は config の `use` を
  継承しない」は一般に流布する理解だが、本リポジトリの Playwright では**継承する**。
  **実測**: `use: { baseURL }` あり → `newContext()` 後の相対 `goto` は URL が解決され timeout /
  `use: {}` なし → `Cannot navigate to invalid URL`。**ソース**: `playwright/lib/index.js:207-208` が
  config の `baseURL` を `_combinedContextOptions` へ入れ、`:222` が
  `playwright._defaultContextOptions = _combinedContextOptions` としてグローバルに設定するため、
  `browser.newContext()` が自動的に受け取る。よって明示的な引き継ぎは不要。
  既存 `tests/e2e/messages.spec.ts:229-241` も `newContext()` 後に相対 `goto` を使っている。

### Round 12 の副産物（本ラウンドのスコープ外 — 次ラウンドの候補）

triage 中に実物照合で判明したが、34 件のいずれにも該当しないため**手を付けていない**もの:

1. **tech.md の構造化ログ規約と `paypal.ts` の乖離**（P-18 で判明）。tech.md「構造化ログ」は
   2 引数形式 `{ error: error.message, stack: error.stack }` を定め**実装例として `src/queries/paypal.ts` を
   名指し**するが、実物は 3 引数の位置指定形式（12 箇所）。規約・実装のどちらを直すかは判断事項
   （`src/lib/log.ts` の `logError` への統合が `coupon.ts` / `order.ts` で進行中・`paypal.ts` は未移行）。
   plan 026 でテストを付けてから移行すると差分が機械的に見える。
2. **plan 023 のステータス drift**。`plans/README.md:71` は 023 を **TODO** とするが、
   route のクランプは `7f2365e` で実装済み・`route.test.ts` の正規化 5 ケースも存在する
   （ただし P-15 のとおり fallback 経路は未カバー）。
3. **`plans/015` の GIN 確認行の自己矛盾**。「期待」列が「生 SQL で追加済みの GIN/tsvector が
   **無いことを確認**」としつつ同じセルで「schema.prisma だけ見て『GIN なし』と断定しない」と警告。
   実際には GIN 式インデックス `Product_fulltext_idx` が**実在**する（Round 11 の P-44 で確定）。
   P-44 と同型の事実誤りだが 34 件の対象外。
4. **`plans/025` の調査コマンド表が壊れている**。`grep -rniE "ratelimit|upstash|throttle"` の
   未エスケープ `|` が markdown の表を分断し（MD056）、**レンダリング後のコマンドが欠落**する
   （読者がコピーすると動かない）。P-07 / P-08 と同型だが 34 件の対象外。

### Round 12 完了時点の全体像

| ラウンド | 対象 | accepted | rejected |
|---|------|---------|---------|
| Round 10 | src/ 4 件 + docs 10 件 | 13 | 1 |
| Round 11 | plans/ 59 件のうち 25 件 | 24 | 1 |
| **Round 12** | **plans/ 残り 34 件** | **30** | **4** |
| **合計** | **73 件** | **67** | **6** |

**CodeRabbit ローカルレビュー 73 件の triage はこれで完了**。未着手はゼロ。

---

## Round 13 追記 — セキュリティ特化 deep 監査（2026-07-17 / HEAD `7080b12`）

- **方法**: `deep security` フォーカス。並列 Explore サブエージェント A〜F（認可/IDOR・入力/XSS・
  決済/ロジック・Webhook/SSRF・ヘッダ/列挙・依存/秘密/PII）で領域分割し、**全所見を本体が
  引用 file:line を直接開いて vet**。詳細台帳:
  [`findings-18-security-r13.md`](findings-18-security-r13.md)。既存 findings-02（SECURITY-01〜09）・
  findings-11（NEW-1〜3）に続く第 3 のセキュリティラウンド。
- **ベースライン実測**: `bunx tsc --noEmit` 0 / `bun run lint` 0（warn のみ）/ `bun audit` 90 件
  （critical 1 / high 30 / moderate 45 / low 14）。内訳は findings-18 §0 を参照。
- **実装状態 reconcile**: plans 001〜004 は README・実装ともに DONE で整合。**NEW-1（plan 023）/
  NEW-2（plan 024）は実装済みなのに README Status が TODO のまま**（ドリフト → Round 13 の
  README 更新で DONE に補正）。

### Round 13 vetted findings 表（leverage 順）— HEAD `7080b12` / 2026-07-17

| # | Finding | Category | Impact | Effort | Risk | Confidence | Evidence |
|---|---|---|---|---|---|---|---|
| R13-1 | SECURITY-10 `getCoupon` が認可・所有権なしでクーポン行を返す（cross-store IDOR read） | security | 他店舗/PLATFORM のクーポン code・discount 漏洩→不正利用 | S | LOW | HIGH | `coupon.ts:1,147-165` |
| R13-2 | SECURITY-12 PayPal capture が金額・注文相関・通貨を未検証（Stripe パリティ欠落） | security | 過少支払いで高額注文が Paid に | S | LOW | HIGH | `paypal.ts:186-283` vs `stripe.ts:189-216` |
| R13-3 | SECURITY-13 PayPal capture に settled-status ガードなし（確定済み決済の退行） | security | 確定注文を Failed へ退行可能 | S | LOW | HIGH | `paypal.ts:210-218` vs `stripe.ts:182-184` |
| R13-4 | SECURITY-14 `upsertCoupon`/`upsertCouponAsAdmin` がサーバー側 Zod 未検証（discount>99 → 注文 total 負値化） | security | フォーム契約(<100%)とサーバー実装のドリフト | S–M | LOW–MED | HIGH | `coupon.ts:81-89,397-398` / `schemas.ts:542-548` |
| R13-5 | SECURITY-06（再掲・未プラン化の現存所見）セキュリティレスポンスヘッダ不在 | security | /checkout 決済面の clickjacking/CSP 防御欠如 | M | LOW | HIGH | `next.config.mjs` / `middleware.ts` |
| R13-6 | SECURITY-05（再掲・未プラン化の現存所見）検索 route が生 `error.message` を 500 で返す + `catch(error:any)` | security | 内部エラー詳細の情報開示 | S | LOW | HIGH | `index-products/route.ts:134,414` |
| R13-7 | SECURITY-15 主要ミューテーションのサーバー側 Zod 検証欠落（広域・SECURITY-14 の上位集合） | security | データ品質・境界検証の穴 | M | MED | HIGH | `product.ts:71`/`review.ts:15`/`user.ts:347` ほか |
| R13-8 | SECURITY-16 Cloudinary unsigned upload preset・type/size 制約欠如 | security | 第三者アップロード濫用（preset 構成依存） | M | MED | MED | `image-upload.tsx:92` ほか |
| R13-9 | SECURITY-17 Webhook ステータスの無条件上書き（out-of-order 退行） | security | 確定決済状態の退行余地 | S–M | LOW | MED | `webhooks/stripe/route.ts:153-180`・`paypal/route.ts:241-268` |
| R13-10 | SECURITY-18 Clerk/Svix 検証が raw body でない（fail-closed 信頼性） | security | 正当 webhook の検証失敗→user 同期欠落 | S | LOW | MED | `webhooks/route.ts:40-41` |
| R13-11 | SECURITY-19 公開検索エンドポイントに入力長上限なし | security | per-request 検索コスト増幅（DoS 補助） | S | LOW | MED | `index-products/route.ts:16-25`・`search-products/route.ts:22-26` |
| R13-12 | AUTHZ-02 seller-store layout が `[storeUrl]` 所有権未検証（多層防御） | security | クエリ層が実データを守るため境界一貫性ギャップ | S | LOW | MED | `stores/[storeUrl]/layout.tsx:19-45` |
| R13-13 | AUTHZ-03 `getProductMainInfo` が caller チェックなし | security | 大半公開のため LOW | S | LOW | HIGH(欠如)/LOW(影響) | `product.ts:478-506` |
| R13-14 | LOGIC-22 送料計算の二系統分岐（Decimal 内製 vs float 表示） | tech-debt | 表示額と課金額の drift・規約違反 | M | MED | HIGH | `user.ts:548-566`・`shipping-utils.ts:13-42` |
| R13-15 | LOGIC-23 `placeOrder` が qty=0 行を受理し ITEM 送料が負値化 | correctness | 注文データ汚染・合計過小化 | S | LOW | HIGH | `user.ts:502,551-557,730-733` |
| R13-16 | SECURITY-24 クーポン利用回数制限なし・`CouponToUser` 未使用 | security | 単一クーポンの無制限再利用（仕様確認要） | M | MED | MED | `schema.prisma:670-692`・`coupon.ts:262-265` |
| R13-17 | DEPS-06 recon の lodash「本番非到達」分類が誤り（runtime transitive で到達） | dependencies | 台帳整合（実悪用到達性は低） | S | LOW | MED | `package.json` deps / `bun audit` |

### Round 13 プラン化（自動選定・5 本）

**058**（SECURITY-10）/ **059**（SECURITY-12 + SECURITY-13）/ **060**（SECURITY-14）/
**061**（SECURITY-06）/ **062**（SECURITY-05）。

**着手順**: 058 / 059 / 060 / 061 / 062 はいずれも相互依存なし。059 は `isSettledPaymentStatus`
共有化のため `stripe.ts` に軽微に触れる。**水増しせず HIGH confidence × 高レバレッジ 5 本に限定**
（R7 前例に倣い、候補は薄くないが P3/LOW は deferred へ回した）。

### Round 13 deferred（再評価条件つき）

R13-7〜R13-17 は findings-18 §3 の deferred 表に条件付きで記録（SECURITY-11 dompurify は依存
refresh 枠 / SECURITY-15 は plan 060 の横展開 / SECURITY-16 は investigate 先行 / SECURITY-17 は
plan 059 の settled-guard 展開 + plan 032 調整 / SECURITY-18・19 は低コスト同梱 / AUTHZ-02/03・
LOGIC-22/23・SECURITY-24 はレバレッジ下位または仕様判断先行 / DEPS-06 は台帳訂正のみ）。

### Round 13 considered and rejected / by-design（再監査防止）

- `chart.tsx:81-98` の `dangerouslySetInnerHTML`: 開発者定義 config 由来・外部入力なし・shadcn 上流標準 → **by-design**。
- `subCategory.ts:188-190` の `ORDER BY RANDOM() LIMIT ${limit}`: `number|null` 束縛・連結なし → **注入なし clean**。
- PayPal sandbox URL ハードコード（`paypal.ts:189`）: rejected 済み SECURITY-07 と同一 → **再報告せず**。
- `applyCoupon` の `cart.total` ロストアップデート: `08-open-questions.md` 既記録 → **再報告せず**。
- CORS / 認証系列挙 / セッション / CI SHA pin / 秘密取り扱い / PII ログ: いずれも **clean**（詳細 findings-18 §4）。

### Round 13 の副産物（本ラウンドのスコープ外 — 次ラウンド候補）

- **JSDoc の stale**: `getCoupon` の `@PermissionLevel Public`（`coupon.ts:145`）と `upsertReview` の
  `@access Admin only`（`review.ts:9`）は実装と乖離。plan 058/060 で認可を足す際に併せて訂正すると
  差分が機械的に見える（プラン内 Maintenance note で言及）。
- **`product-description.tsx:1` の `'use-client'` 誤記**（正しくは `'use client'`）: 実質サーバー
  コンポーネント化しているが sanitize は jsdom でサーバー実行可能なため XSS 影響なし。tech-debt レベル。

---

## Round 14 追記 — CodeRabbit レビュー第4弾 + Phase A 実装（2026-07-19 / HEAD `b5d0c66`）

> **⚠️ 本ラウンドは他ラウンドと性格が異なる — `src/` と `tests/` を実際に変更している**。
> Round 1〜13 は improve スキルの監査ラウンドで Hard Rule 1（advisor はソースを変更しない）に
> 従っていたが、Round 14 は **CodeRabbit レビューの指摘に対する実装セッション**であり、
> 監査ではない。したがって `plans/**` のみ編集という制約は適用されない。
> **「ソース無変更」を Round 14 に期待しないこと**（`git diff 72e8004..b5d0c66 --stat -- src tests`
> は空ではない — これは違反ではなく本ラウンドの目的そのもの）。
>
> **⚠️ 範囲記法の注意**: 本ラウンドの baseline は **`72e8004`**（Round 13 末尾のコミット）であり、
> `934b6fa` は **Phase A-2 の修正コミットそのもの**である。git の `A..B` は A を含まないため、
> `934b6fa..b5d0c66` と書くと A-2 が範囲から脱落する。**範囲は `72e8004..b5d0c66`（6 コミット）**
> と書くこと（`934b6fa^..b5d0c66` でも同義）。

- **出所**: CodeRabbit が `dev`（vs `main` / 81 ファイル）に対して実施したレビュー。
  VSCode の「問題」パネル表示は **114 件**（⚠49 + ⓘ65）だが、これは
  **NEW REVIEW + PREVIOUS REVIEWS (2) の合算**であり純粋な新規指摘数ではない。
  精査後の実体: `plans/ja/*` ミラー重複 5 / 同一箇所の言い換え重複 4 / 既に解消済み（誤検知）3 /
  **要対応 約 81**（コード 5 + プラン/ドキュメント 76）。
- **実行計画**: `~/.claude/plans/claude-rules-02-tdd-step-commit-md-peaceful-globe.md`
  （Phase A = コード修正 / Phase B = 監査台帳の整合性回復 / Phase C = 個別プラン文書 約 60 件）。
- **コミット規律**: `.claude/rules/02-tdd-step-commit.md` に従い 1 論理単位 = 1 コミット。

### Round 14 Phase A — 実装済み（6 コミット / `72e8004..b5d0c66`）

| # | 修正 | 深刻度 | コミット | 変更ファイル |
|---|------|-------|---------|-------------|
| A-2 | `custom_id` の相関検証を `captureData` パース直後・**全 status 書き込みの上流**へ移動（従来は `status !== "COMPLETED"` 分岐の後ろにあり、他人の PayPal Order の DENIED/DECLINED 応答で自分の注文を `Failed` に落とせた。金額/通貨の突合は COMPLETED 応答にしか値が載らないため現位置に残す） | 高 | `934b6fa` | `paypal.ts` + `paypal.test.ts` |
| A-1 | PayPal/Stripe の settled ガードを CAS 条件で原子化（`update.where` に `paymentStatus: { notIn: [...SETTLED_PAYMENT_STATUSES] }` を混ぜ、P2025 を既存メッセージ `"Order payment is already settled."` へ写像） | 高 | `4261be0` | `paypal.ts` + `paypal.test.ts` |
| A-3 | `PaymentDetails.amount` を **ドル建て**へ統一（Stripe 側が `paymentIntent.amount`（セント: 3000）を `Decimal(12,2)` 列へ書いていた単純バグ。`order.total` を `Prisma.Decimal` のまま渡す形へ） | 中 | `e63474b` | `stripe.ts` + `stripe.test.ts` |
| A-5 | `placeOrder` のサーバー側冪等性（`$transaction` 先頭で `cart.deleteMany({ id, userId })` → `count === 0` を CAS ゲートに。カート行が単一使用トークンとして働き、同一 `cartId` の二重注文を行ロックで直列化） | 高 | `824e224` | `user.ts` + `user.test.ts` |
| A-4a | `route.test.ts` の `mockRestore()` を `afterEach(jest.restoreAllMocks)` へ集約（アサーション失敗時に spy が漏れて後続テストを汚染していた） | 低 | `15aef5c` | `index-products/route.test.ts` |
| A-4b | security-headers E2E に `response.status()` の検証を追加（500 でもヘッダが付けば pass していた） | 低 | `b5d0c66` | `security-headers.spec.ts` |

### Round 14 rejected（0 件）

**本ラウンドに rejected はない。** Phase A は計画どおり A-1〜A-5 の **6 コミット全てが実装済み**。

> **⚠️ 訂正記録（Phase B 初回記述の誤り — 再発防止）**
>
> Phase B の初版はここで **A-2 を「却下 — 前提が誤り（既に充足済み）」と誤って記録していた**。
> 根拠として `git show 934b6fa:src/queries/paypal.ts` を「ラウンド開始時点」として引き、
> `capturedCustomId !== orderId` が L228・status 分岐が L233 で**既に上流にある**と述べていた。
>
> **これは範囲記法の off-by-one による誤読である。** `934b6fa` は baseline ではなく
> **A-2 の修正コミットそのもの**（メッセージ: `fix(paypal): validate custom_id before any
> status-driven order write`）。上記は「修正後」の姿を「修正前」と取り違えていた。
>
> **真の baseline `72e8004` での実測**（`git show 72e8004:src/queries/paypal.ts`）:
>
> | リビジョン | `capturedCustomId !== orderId` | `status !== "COMPLETED"` | 判定 |
> |---|---|---|---|
> | `72e8004`（baseline） | L242 | **L219** | 検証が後ろ → **脆弱性は実在した** |
> | `934b6fa`（A-2 修正後） | **L228** | L233 | 修正済み |
>
> **教訓（次ラウンドの判断基準に追加）**: 「指摘は既に解消済みでは」と判定する際、
> **参照するリビジョンが baseline か修正後かを必ず確認する**こと。`A..B` は A を含まないため、
> 範囲の左端をそのまま「開始時点」として `git show` すると、**当該ラウンド自身の修正を
> 「元からそうだった」と誤認する**。baseline を見るなら `A^` を使う。

### Round 14 が既存台帳へ与える影響（reconcile）

1. **CORRECTNESS-05**（`PaymentDetails.amount` の単位不一致 Stripe セント vs PayPal ドル）—
   [`../README.md`](../README.md) の Deferred 節に「needs backfill」として記載。
   **コード側は A-3 で解消**したが、**過去に Stripe 決済で作成された行はセント値のまま残る**。
   → **データ補正（backfill）は [plan 063](../063-backfill-stripe-payment-amount.md) として
   起票済み**（P2 / TODO・[`../README.md`](../README.md) の Status 表 :126）。
   「未起票のまま」と書いていた旧記述は 2026-07-27 の起票時点で失効している。
   Deferred 記載は維持し、範囲を「コード修正」から「既存行の backfill のみ」へ縮小して
   読むこと（README :251 の該当行も同じ結論に更新済み）。
2. **「Server-side `placeOrder` idempotency」**（plan 006 から deferred されていた項目）—
   **A-5 で解消**。README Deferred 節の該当行は消化済み。
3. **TESTS-02 capture 経路**（R1 raw / R5〜R6 deferred）— 先行依存としていた plan 003 は DONE、
   さらに A-1 / A-3 で capture 経路自体が変化した。**deferred 理由が失効**しており昇格の
   再評価対象（[`findings-13`](findings-13-integration-coverage.md) /
   [`findings-14`](findings-14-integration-coverage-r6.md) の該当行に注記済み）。
4. **`saveUserCart` 統合**（R5 rejected / R6〜R7 deferred 維持）— 先行依存の plan 005 は DONE。
   **同じく deferred 理由が失効**（[`findings-17`](findings-17-e2e-coverage-r9.md) TESTS-42 に注記済み）。
5. **SECURITY-17**（webhook ステータスの無条件上書き → out-of-order 退行 / R13 deferred）—
   A-1 が確立した CAS ガードのイディオムを **webhook 側へ横展開**すれば解消できる。
   findings-18 §3 の「plan 059 の settled-guard を webhook へ展開」という昇格条件は
   **A-1 の着地でより具体化した**（`notSettled()` ヘルパーが `paypal.ts` に実在する）。

### Round 14 未着手（Phase C — 約 60 件）

`plans/003`〜`plans/062` の個別プラン文書に対する指摘。**1 プラン = 1 コミット**で進める。
このうち**約 15 件は CodeRabbit のタイトルのみでは修正内容を確定できない**
（例: `plans/013`「Make ADR numbering deterministic」/ `plans/025`「Align the "repo-wide" claim」/
`plans/044`「port check does not eliminate server-reuse races」/ `plans/017`「Include every
result-shaping input in recommendation cache keys」/ `plans/038`「Isolate the temporary DDL
constraint from the integration suite」）。**着手時に該当コメントの詳細本文を入手すること**
（Round 11 の判断基準 3「指摘タイトルの字面適用は設計意図を壊す」）。
