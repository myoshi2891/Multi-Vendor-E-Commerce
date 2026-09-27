# Deferred / Rejected findings（生きた台帳）

旧 `plans/README.md` の "Deferred" / "Findings considered and rejected" 節を 2026-09-26 に分離した。
**direction 残候補・見送り事項の単一の出所はこのファイル**（`ADVISOR_STATE.md` の参照先）。
追加・削除はここだけを更新すること。各ラウンドの経緯は [`archive/README-full-log.md`](archive/README-full-log.md)。

## Deferred (meaningful findings, not planned this round)

Tracked in [`audit/VETTED_FINDINGS.md`](audit/VETTED_FINDINGS.md); candidates for a future round or `execute`/added plans:

- **CORRECTNESS-06（新規・2026-08-11 起票 / plan 048 の実行中に実測）**
  `src/components/store/cards/store-card.tsx:30-31` の
  `if (!user.isSignedIn) router.push('/sign-in')` に **`return` が無い**。加えて Clerk の
  `useUser()` は**ロード完了まで `isSignedIn: false` を返す**ため、
  **サインイン済みのユーザーがハイドレーション直後にフォローを押すと、`/sign-in` へ push
  され（サインイン済みなので `/` へ跳ね返され）フォローも成立しない**。
  plan 048 の初回実装で 3 回とも決定論的に再現した（クリック後 URL が `/`・toast なし・
  フォロワー 0 のまま）。最小修正は `if (!isLoaded) return;` の追加と
  `router.push` 後の `return`。**修正したら `tests/e2e/engagement.spec.ts` の
  `waitForClerkLoaded` が不要になる可能性が高い**ので併せて見直すこと。
  同じ形（`isSignedIn` だけを見て早期に分岐する client component）が他にも無いか
  横断確認する価値がある。
- **DEPS-04** Prisma 5.22 → 6.x major upgrade (spike; full-text-search + Accelerate revalidation).
- **PERF-01** cart/checkout per-item N+1 (batch product/shipping/country lookups) — MED risk, money-critical.
- **PERF-05** cache stable reference data (categories/countries/offer tags) via `unstable_cache`/Accelerate.
- **CORRECTNESS-01** Stripe `charge.refunded` webhook correlation (correlate by `paymentIntentId`).
- ~~**CORRECTNESS-05** `PaymentDetails.amount` unit mismatch (Stripe cents vs PayPal dollars)~~ — **コード修正は Round 14 (`e63474b`) と `c4a6fb41`（2026-08-07）で完了**。`schema.prisma:699` が `Decimal(12,2)` = ドル建てを宣言しており PayPal 側は元から正しく、Stripe 側が `paymentIntent.amount`（セント）を書いていた単純バグだった。**⚠️ `e63474b` が直したのは同期パス `src/queries/stripe.ts` だけで、webhook `src/app/api/webhooks/stripe/route.ts` は cents を書き続けていた**（plan 032 の Scenario S1 が characterization として固定していた）。webhook 側は `c4a6fb41` で `order.total` 保存に統一済み。**残っていた既存行の backfill も [plan 063](063-backfill-stripe-payment-amount.md) で完了（2026-08-09・DONE）**（**カットオーバー境界は `e63474b` ではなく `c4a6fb41`**。実測では補正対象 0 件 —— 本番 DB の `PaymentDetails` が総行数 0 で、補正すべき歴史的データが存在しなかった。検証は `still_wrong=0` / `null_ratio=0` / `stale_paypal_currency=0`）。**本項目はコード・データとも完了**であり、「コード修正が必要」とも「backfill が残っている」とも読まないこと。
- ~~**TESTS-05** integration test for `placeOrder` oversell-rollback branch (testcontainers).~~ → **Round 4 で plan 027 に昇格**（TESTS-08 と統合）。
- ~~**TESTS-14**（Round 4）2026-06 追加機能（track-order / support-forms / compare / offers / static pages）のゲスト E2E 導線 — component 層は厚く増分価値は中。026〜030 完了後に再評価。~~ → **Round 8 で plan 045 に昇格**（E2E 実測で認証系が全滅中と判明し、認証不要で安定して回るゲスト導線の相対価値が上昇）。
- **Round 8 deferred（詳細: [`audit/findings-16-e2e-coverage.md`](audit/findings-16-e2e-coverage.md)）**: 販売者ダッシュボード CRUD E2E（OI-11 `self is not defined` 本番ビルド SSR ブロッカーの解消が先行 — ユーザー決定済み）・決済失敗ロールバック E2E §20 P0（Stripe 実キー + 失敗カード前提で effort L。Integration plan 032 が DB 巻き戻しを部分カバー）・payment-error `:58` 在庫切れ表示（機能未実装）/`:70` 二重送信（plan 006 先行）・mobile-responsive skip 2 件（ハンバーガー / 375px カートとも機能未実装）。**アプリ側ギャップの新規発見 2 件**: /browse にページネーション UI 未実装（plan 046 が最小配線ごと担当）・`getProducts` に store status フィルタが無く BANNED 店舗の商品が /browse に露出（§20 P1 の半分が未達 — 次回 correctness ラウンドの P1 候補、findings-16 TESTS-38 追記参照）。
- **Round 9 deferred（詳細: [`audit/findings-17-e2e-coverage-r9.md`](audit/findings-17-e2e-coverage-r9.md)）**: R8 deferred 5 件は**全件維持**（ソース無変更のため先行条件が不変であることを再裁定済み）。新規 deferred: Newsletter 購読の**成功系** E2E（route + スキーマ + 保存先が丸ごと不在 — 機能実装プランが先行。characterization は plan 056 が担当）・home（`/`）の a11y / VRT（OI-9 `featured.tsx` SSR 500 の解消が先行 — 解消後に plan 052 / 054 の形式で追加）。
- **Round 9 rejected（詳細: findings-17 Rejected 節）**: カスタム 404 ページ E2E（`not-found.tsx` 不在 — Next デフォルト挙動の検証は低価値、実装が先）・フルサインアップ E2E（確認コード入力までのフロー全長は Clerk 自身のテスト責務に近い — ウィジェット描画スモーク〔plan 053〕で UI ドリフト検出は達成）・言語/通貨セレクタ E2E（静的表示のみで操作可能な機能が無い。多通貨は product.md スコープ外）。
- **Round 8 rejected（詳細: findings-16 Rejected 節）**: ページネーションの route-mock 方式復活（SSR に効かず壊れた実績）・3 ブラウザフル E2E の CI 常設（wall-clock 25.5m+ と Clerk 実キー secrets 運用が前提 — chromium 限定 nightly を別途設計）・a11y `color-contrast` ルール有効化（既知デザイン負債として QA_HANDOFF で追跡中）。
- **TESTS-02**（Round 1 raw）capture 経路（`src/queries/stripe.ts` / `paypal.ts` 同期パス）の実 DB 統合テスト — **先行依存だった plan 003 は DONE（PR #158 マージ済み・上の Status 表）**。したがって「003 待ち」を理由に deferred を維持する状態は解消済みで、着手可能。低コストな入り口は plan 032 の `webhook-payment.test.ts` へ同型シナリオを追加すること（新規スイートを起こさない）。現状 deferred のままなのは、**Stripe 側は優先度の判断**であって依存によるブロックではない（`stripe.ts:275-310` は既に `db.$transaction` + CAS で原子化済み）。**PayPal 側は依存が残る** —— `paypal.ts:399` の `paymentDetails.upsert` と `:441` の `order.update` は**別々の書き込み**で、`4261be0` が入れたのは `notSettled()` の CAS 条件であって `$transaction` ではない（退行レースは閉じたが部分適用は残る）。経路ごとの現況は [`audit/findings-13-integration-coverage.md`](audit/findings-13-integration-coverage.md) の 「TESTS-02 の現況」表が SSOT。~~TESTS-04（webhook）・TESTS-06（restock）~~ → **Round 5 で plan 032 / 031 に昇格**。
- **Round 5 rejected（詳細: [`audit/findings-13-integration-coverage.md`](audit/findings-13-integration-coverage.md)）**: saveUserCart 統合（plan 005 のコード修正が先行 — 005 完了後の追加候補。**Round 6 で deferred 維持を再確認**）・sendMessage 配列 tx（低レバレッジ）・~~`updateProduct` specs/questions tx + `generateUniqueSlug`（次点候補）~~ → **Round 6 で plan 038 に昇格**・`ORDER BY RANDOM()` 単独プラン化（033 の従属シナリオで充足）・removeCoupon 拡張（unit 網羅済み）。
- **Round 6 rejected（詳細: [`audit/findings-14-integration-coverage-r6.md`](audit/findings-14-integration-coverage-r6.md)）**: followStore トグル（implicit M2M unique が保護・unit 網羅済み）・addToWishlist 重複ガード（複合 unique 制約が存在せず実 DB で検証できる制約がない — unique 追加はスキーマ変更系）・~~dashboard taxonomy/coupon upsert 群（次点候補）~~ → **Round 7 で coupon のみ plan 041 に昇格**（事前チェックのスコープ不一致により P2002 が決定論的到達可能と判明。category 系は R7 rejected 維持）・applyCoupon total ロストアップデート（コード修正 `$transaction` 化が先行する correctness 事案 — 上記 Deferred 記録を維持）・~~`getStoreOrders` 等ダッシュボード一覧系の実 DB ページング（閲覧頻度・リスク低）~~ → **Round 7 で deferred へ変更**（plan 009 が bound を追加予定のため 009 完了後の追加候補 — テスト先行は書き直しになる）。
- **Round 7 rejected（詳細: [`audit/findings-15-integration-coverage-r7.md`](audit/findings-15-integration-coverage-r7.md)）**: category/subCategory/offerTag upsert 群（事前チェックがグローバルスコープで unique と整合 — P2002 は race 限定・フォールバック未実装はコード修正が先行する事案）・applySeller/upsertStore 一意性（name/phone は DB 非強制だが事前チェックは unit 網羅済み・plan 002 が update 経路を変更予定）・profile 読み取り群（plan 039 と同じ Prisma セマンティクス族 — 039 完了後の横展開候補）・dashboard 集計系（`unstable_cache` の試験環境リスクが増分価値を上回る）・upsertShippingRate（複合 unique を where に使う正しいイディオム — ギャップなし）・getStorePageDetails 等単純 read（低レバレッジ）。
- **TESTS-09**（Round 1 raw）`jest.config.js` の page.tsx 一律除外の見直し — 分母変更はダッシュボード全指標に波及するため単独ラウンドで扱う。
- **dashboard forms 群の component テスト**（Round 4 rejected 詳細: [`audit/findings-12-test-coverage.md`](audit/findings-12-test-coverage.md)）— `admin-coupon-details.test.tsx` パターンで可能だが money-path より低レバレッジ。
- **`catch (error: any)` 残存 2 箇所**（`cart-page/summary.tsx:30` / `stripe-payment.tsx:28`）— no-any 規約違反の単独 fix 候補（前例 `22bb3f3`）。plan 030 のテストが回帰検知になる。
- **DX-01 / PERF-09** CI dependency/Prisma/build caching (same finding).
- **TECHDEBT-01 (bulk)** the ~90-site legacy `console.error` → `logError` migration (after plan 007).
- **TECHDEBT-02** break up `product-details.tsx` (1382-line god component) — L effort, characterization tests first.
- **TECHDEBT-03** extract `usePaginatedFilteredList` from the 3 profile tables.
- ~~**Server-side `placeOrder` idempotency** (concurrent double-submit) — deferred from plan 006.~~ → **Round 14 (`824e224`) で解消**。`$transaction` 先頭の `cart.deleteMany({ id, userId })` の削除件数を CAS ゲートにし、カート行を単一使用トークンとして扱う（既存の在庫減算 CAS と同一イディオム）。**残件**: `applyCoupon` の lost-update `$transaction` リファクタは**別事案として未解決**（下の tech-debt 群および `08-open-questions.md` を参照）。
- ~~**webhook の `upsert` がプロバイダー切替時に `PaymentDetails.amount` / `currency` を更新しない**~~
  → **`c4a6fb41`（2026-08-07）で解消。** 両 route の `update` 分岐に `amount` / `currency` を追加し、
  あわせて **Stripe webhook の単位バグ本体**も直した（event の cents ではなく `order.total` を保存。
  cents を返す `extractAmountAndCurrency` は `extractCurrency` に縮小し、再配線の余地を消した）。
  plan 032 の Scenario P4 は characterization を解除し、切替後に `amount = ORDER_TOTAL` /
  `currency = usd` へ更新されることを検証する形に反転済み（`607c2b88`）。
  **既存行の backfill は [plan 063](063-backfill-stripe-payment-amount.md) が担当し、2026-08-09 に
  DONE**（実測で補正対象 0 件 —— `PaymentDetails` が総行数 0 だった）。
  063 の**カットオーバー境界は `e63474b6` ではなく `c4a6fb41`** —— `e63474b6` が直したのは
  同期パスだけで、webhook はその後も cents を書き続けていたため（063 Step 1 に訂正記録あり）。
  以下は発見時の記録:
  — **[plan 032](032-integration-test-webhook-payment-idempotency.md) の実行中に発見**（2026-08-04 記録）。
  `src/app/api/webhooks/stripe/route.ts` と `paypal/route.ts` の `paymentDetails.upsert` は、
  `update` 分岐に **`amount` と `currency` を持たない**（`create` 分岐にしか無い）。そのため同一注文が
  別プロバイダーで確定し直されると、行は 1 本に保たれるものの
  **「`paymentMethod: PayPal` なのに `amount` は Stripe が書いたセント値」**という**単位混在**で残る。
  Stripe 経路は event の `amount`（**cents**）を、PayPal 経路は `order.total`（**ドル建て**）を
  格納する設計なので、残留値は単位ごと誤る（例: 正しくは `110.00` のところ `9999`）。
  **CORRECTNESS-05（Stripe cents vs PayPal dollars）と同じ族**で、二重計上・返金額誤りに直結しうる。
  修正は `update` 分岐にも `amount` / `currency` を含めること（各経路の格納規則は現状のまま）。
  現挙動は plan 032 の **Scenario P4 が characterization として固定済み**なので、修正時には
  当該テストが正しく赤くなる（期待値を `ORDER_TOTAL` 側へ反転する）。
  （↑ここまで発見時の記録。実際に P4 は反転され、本体修正は上記のとおり完了した。）
- **`updateOrderGroupStatusAsAdmin` の並行二重復元** — deferred from [plan 031](031-integration-test-order-lifecycle-restock.md)（2026-07-31 記録）。`order.ts:441-471` は `findUnique` で `prev.status` を読んでから `update` する **read-then-act** のため行ロックを取らず、並行 2 者が同じ非終端 status を読んで**両方が `restockOrderItems` を実行しうる**。修正は `updateOrderPaymentStatus` と同型の**条件付き `updateMany`（CAS）**への統一（`where` に `status: { notIn: [...] }` を置き `count === 1` の内側でのみ復元 — 前例 `d0005bb`）。plan 031 はテスト追加のみのスコープであり、Scenario 2 が並行安全性を固定しているのは `updateOrderPaymentStatus` 側**のみ**。本項目は**本体修正**として未着手。
- ~~**重い注文フロー E2E の間欠 120s ハング（サインイン後の商品ページ `goto` タイムアウト）** —
  deferred from [plan 042](042-e2e-signin-helper-repair.md)（2026-08-03 記録）。~~ →
  **[plan 047](047-e2e-checkout-order-detail.md) で解消**（2026-08-03）。真因は
  `waitForPostSignInSettle`（サインイン後の networkidle 待ち）で、これを通すと後続の `goto` が
  リクエストを 1 件も発行しないままハングしていた。注文フロー spec から除去し、3 ブラウザ実測で
  **9 passed / 6 skipped / 0 failed / flaky 0**。`gotoStable` は Firefox の `NS_BINDING_ABORTED`
  吸収に必要なため残置。**残件**: plan 042 の Step 5-6（全 spec の再実測・検証）は未実施のまま。
- **`placeOrder` の住所所有権ロックの実 DB 並行検証** — deferred from CodeRabbit round（2026-07-31 記録）。`user.ts` の `SELECT … FOR UPDATE`（`f77dafd`）が並行 `userId` 付け替えを実際にブロックすることは、unit テストがモック境界で止まるため観測できない。検証は Integration（testcontainers）でのみ可能で、低コストな入り口は `tests/integration/` の既存スイートへ 2 トランザクション競合シナリオを足すこと（新規スイートを起こさない）。unit 側は「`$queryRaw` が `order.create` より前に呼ばれ、0 行なら throw する」呼び出し契約の固定まで完了済み。
- **Full server-side pagination of seller orders** — deferred from plan 009 (changes `StoreOrderType` + DataTable search).
- **Direction**: DIRECTION-01 refund execution (L, HIGH risk), DIRECTION-03 support-ticket console, DIRECTION-04 i18n foundation, DIRECTION-05 error monitoring (roadmap Phase 5). → Round 2 でロードマップ上に配置済み（[`direction/EXPANSION_BLUEPRINT.md`](direction/EXPANSION_BLUEPRINT.md) §5: Phase C に 01/02/03/05、Phase D に 04）。
- **Round 13 deferred（詳細: [`audit/findings-18-security-r13.md`](audit/findings-18-security-r13.md) §3）**: 5 本をプラン化（058〜062）した後の残余。**SECURITY-11**（`dompurify >=3.1.3 <3.2.7` XSS advisory・`src/utils/sanitize.ts` 経由で本番 UI 到達だが sink は sanitize 済み → 依存 refresh 枠で patched 版へ。plan 057 の `next` bump と同じ依存メンテ、個別プラン化しない）・**SECURITY-15**（主要ミューテーションのサーバー側 Zod 検証欠落〔review/shipping-address/product〕— plan 060 が coupon で確立するパターンの横展開 follow-up。`upsertProduct` は `ProductWithVariantType` の型差分の突合が必要）・**SECURITY-16**（Cloudinary unsigned upload — preset の signed/unsigned・ダッシュボード制約がコード外のため investigate 先行）・**SECURITY-17**（webhook ステータスの無条件上書き→out-of-order 退行 — plan 059 の settled-guard を webhook へ展開 + plan 032 と調整）・**SECURITY-18**（Clerk/Svix 検証が raw body でない fail-closed 信頼性 — 低コスト、次の webhook 作業に同梱）・**SECURITY-19**（公開検索の入力長上限なし — rate-limit spike plan 025 と併走）・**AUTHZ-02**（seller-store layout の `[storeUrl]` 所有権未検証・多層防御 — クエリ層が実データを守るため MED）・**AUTHZ-03**（`getProductMainInfo` caller チェックなし — 大半公開で LOW）・**LOGIC-22**（送料計算の二系統分岐 Decimal vs float — tech-debt / 規約ドリフト）・**LOGIC-23**（`placeOrder` qty=0 → ITEM 送料負値化 — LOW correctness）・**SECURITY-24**（クーポン利用回数制限なし・`CouponToUser` 未使用 — 1人1回制限が仕様意図か product 判断先行）。

## Findings considered and rejected (so nobody re-audits them)

- **SECURITY-07** PayPal sandbox endpoint hardcoded (`paypal.ts:72,189`): LOW confidence — verify intended prod env wiring first; investigate, not a fix.
- **SECURITY-08/09** older raw-`error.message` interpolation / `upsertReview` purchase verification: LOW confidence, mitigated by Next.js server-action error masking.
- **DEPS-05** dev-only advisories (handlebars/ws/picomatch): not production-reachable; fold into routine dev-tool refresh.
- **DEPS-08** Next.js 16.2.1: already current — no action. **⚠️ この却下は Round 1（2026-07-03 / HEAD `f9752c0`）時点の判断であり、現在は無効**。Round 9 以降に GHSA-26hh-7cqf-hhc6（HIGH — App Router の Middleware/Proxy バイパス）が公表され、`next@16.2.1` は影響範囲内だった。**対応は [plan 057](057-upgrade-next-middleware-bypass.md)** で `~16.2.10` へ bump 済み。**現行は `~16.3.5`**（`package.json:80` 実測。critical RCE advisory 対応として `60f78c48`〔2026-09-18〕で bump）。経緯として、その前段の `~16.2.12` は `~16.2.10` が新規 9 advisory の影響範囲 `<16.2.11` に再露出したため、057 の再実行ではなく**独立した依存メンテ**として 2026-07-30 に bump したもの。現況の SSOT は [`audit/findings-06-dependencies.md`](audit/findings-06-dependencies.md) DEPS-08 の「現況」節であり、版番号はそちらと `package.json` を突き合わせて読むこと。「already current」を理由に 057 を再監査済みの却下事項と誤認しないこと。
- **DX-09** `.editorconfig`, **TECHDEBT-07** shared dashboard-form scaffold: low value / debatable — spike only if revisited.
- **Decided tradeoffs (NOT findings)**: ADR-001 CSRF (no token module), ADR-002 CI `--verbose`, ADR-003 `setOpen` sync, ADR-004 testcontainers, ADR-005 SonarCloud non-blocking, `reactStrictMode: false`, Elasticsearch commented out (tsvector chosen), DB-page `force-dynamic` (SSG abandonment documented), `middleware`→`proxy` / AVIF warnings unaddressed, and product scope-outs (multi-currency / tax / advanced analytics / shipping-carrier integration). See [`audit/recon.md`](audit/recon.md) "決定済みトレードオフ".
- **Already-fixed security** (still healthy, no regression): PayPal/Stripe userId scoping, `upsertCoupon` ownership, `applyCoupon` CAS, review IDOR — per `docs/testing/SECURITY_GAP_REPORT.md`.
- **Round 13 rejected / by-design（詳細: [`audit/findings-18-security-r13.md`](audit/findings-18-security-r13.md) §4）**: `src/components/ui/chart.tsx:81-98` の `dangerouslySetInnerHTML`（開発者定義 config 由来・外部入力なし・shadcn 上流標準 — by-design）・`src/queries/subCategory.ts:188-190` の `ORDER BY RANDOM() LIMIT ${limit}`（`number|null` 束縛・文字列連結なし — 注入なし）・CORS / 認証系列挙 / セッション（自前実装なし・Clerk 委譲 — clean）・CI SHA pin / 秘密取り扱い / PII ログ（rule 01 充足・`.env` 追跡外・`console.error` は PII 非出力 — clean）。**DEPS-06** は台帳分類の訂正のみ（recon の lodash「本番非到達」は誤り、runtime transitive で到達するが `_.template` 悪用経路は現状未到達 → DEPS-05 の routine refresh に lodash/lodash-es を含める。個別プラン化しない）。

