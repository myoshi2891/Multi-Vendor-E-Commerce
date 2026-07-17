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

### Round 9 deferred（再評価条件つき）

- **R8 deferred 5 件の再裁定**: 販売者ダッシュボード CRUD（OI-11 依存）/ 決済失敗ロールバック / payment-error `:58` 在庫切れ表示 / `:70` 二重送信（plan 006 依存）/ mobile-responsive 2 件 — **いずれも deferred 維持**（先行条件に変化なし）。
- **TESTS-39 の成功系 E2E（Newsletter 購読）**: **機能実装が先行**（route + スキーマ migration + 保存先設計が丸ごと不在）。plan 046 方式の最小配線で吸収できる規模を超える（056 は characterization のみ）。
- **home（`/`）の a11y / VRT**: **OI-9（`featured.tsx` SSR 500）の解消が先行依存**。browse / 商品詳細 / cart と scope 分割し、OI-9 解消後に追加（TESTS-43 / TESTS-44）。

### Round 9 considered and rejected（再監査防止）

- **カスタム 404 ページの E2E**: `src/app/` に `not-found.tsx` / `error.tsx` が存在せず（find で 0 件）、検証対象は Next.js デフォルト 404 のみ。フレームワーク挙動の検証は価値が薄い。
- **フル サインアップ E2E（確認コード入力 → セッション成立まで）**: Clerk test mode 固定コード（424242）前提のフロー全長テストは、`auth.ts` が API 直でユーザー作成する現行設計と重複投資。ウィジェット描画スモーク（053）で足りる。
- **言語 / 通貨セレクタの E2E**: `country-lang-curr-selector.tsx:106-128` の Language / Currency 欄は**静的表示のみ**（onChange ハンドラ無し）。多通貨対応は `product.md` の**スコープ外**。
- **dashboard forms 群 0%**: 内部 UI・money-path よりレバレッジ下位。README 次点候補へ。
