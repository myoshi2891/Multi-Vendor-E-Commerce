# QA & Test Implementation Handoff（次回セッションへの引き継ぎ）

> **最終更新**: 2026-07-27 / **HEAD**: `8637bca5`（CodeRabbit レビュー 19 コメントの精査対応 — 見出しのみ判明していた 19 件を実測で検証し、**確認済み 18 / 誤検知 1** に仕分け。実コード 2 件: `upsertCoupon` / `upsertCouponAsAdmin` の入力検証・重複コードエラーが catch の `Error occurred while ... : ${message}` で上書きされフォームに返せていなかった欠陥を、既存 `isGuardError` と同型の `isDomainError` 素通しで閉塞〔回帰 +4・`76a96296`/`fba1cf46`〕/ `scan-tests.ts` の `BLOCK_PATTERN` が `test.skip(` を拾わず E2E ケース数を 23 と報告し SSOT の 37 と 14 件乖離していた欠陥を修正〔回帰 +3・`ff9f5c28`/`8637bca5`〕。**誤検知 1 件は修正せず記録** — 「`byDomain` に `api-routes` が無くドメイン合計 187」は実測と不一致で、直近 5 バージョンすべてに `api-routes:6` が存在し合計 193 = `totalTestFiles`。指摘値 187 はちょうど `193 - 6`。docs 側の内訳は続くコミットで反映）。直前: `7d063a10`（CodeRabbit レビュー 46 コメントの精査対応 — 実コード 3 件: App Router の route.ts から named export `REDACTED_PII` を `src/lib/pii.ts` へ退避〔route の型検証に引っかかる形・`bfcf52ba`〕/ Stripe 冪等キーが canceled 済み intent を返し続け、当該注文がその金額で恒久的に決済不能になる経路を閉塞〔canceled 観測時のみ別キーで再作成・回帰 +2・`4111e0ad`/`96856785`〕/ `place-order.test.tsx` の `mockImplementation` throw が後続テストへ漏れるのを `mockReset()` で遮断〔`7fe521e5`〕。docs 12 件は plan/audit の整合修正〔検証コマンドのスコープ・POSIX 互換化、latch による並行性の過大主張、findings-18 の値割れ 4 件、Round 13 の計画範囲と 057 の完了状態、ALB の XFF append 前提〕。**未対応**: `next` 16.2.11 bump はネットワーク不可の環境のため保留、「未来日付」系 10 件は 2026-07-26 を超える日付が実在せず偽陽性と判定し変更なし）。直前: `b23c1676`（CodeRabbit レビュー 24 件の残 8 件対応 — 本文が無く保留していた「E: 判断不能」区分を全件確定。実コード 2 件: HSTS の付与判定を環境名から**配信先シグナル**へ移行し、`NODE_ENV=production` だけの self-host staging へ 2 年 max-age が記録されるのを閉塞〔`HSTS_ENABLED` 導入・E2E ゲートも同期・`a1f00f79`/`dcc41fe6`〕/ `useCartStore` の persist ラウンドトリップ検証 +3〔plan 005 の「リロード後に復元される」未検証ギャップを閉塞。元バグ再注入で非空振りを確認・`4531d574`〕。他 6 件は plan/audit doc の整合修正〔011 の env ゲートが superset ではなく 13 変数しか見ておらず `CLERK_SECRET_KEY`/`DATABASE_URL` 欠落を検出できなかった件、015 の ts_rank seek 述語が PostgreSQL で実行不能だった件、021 のベンダー固定と重複配信の絶対保証、027 の jest.mock factory 巻き上げ、findings-06 の現行値と履歴の混在〕）。直前: 2026-07-26 CodeRabbit レビュー 24 件対応 — plan/docs/specs の整合修正 22 件〔検証コマンドの誤検出・並行性証明の不備・撤回済み記述の残存・監査台帳の値割れ等〕に加え、実コード 2 件: `CouponFormSchema.discount` へ `.int()` を追加し小数が Int 列へ到達するのを閉塞〔回帰 +2・`11d68f89`/`6d0cd9dc`〕/ HSTS の `includeSubDomains; preload` を環境名判定から明示 opt-in（`HSTS_INCLUDE_SUBDOMAINS` / `HSTS_PRELOAD`）へ分離し、self-host staging 等での非可逆な preload 誤発火を防止〔`10b3fd1f`/`66ed444f`〕）。直前: 2026-07-24 CodeRabbit ローカルレビュー対応 — plan/audit doc 21 件の整合修正に加え、実コード 3 件のセキュリティ修正〔HSTS を本番ドメイン限定化（Vercel preview 毒回避）`2960381` / `placeOrder` の住所所有権 TOCTOU を tx 内再検証で閉塞 `b95f847` / `user.deleted` webhook で SupportTicket PII を削除前に秘匿化（GDPR 消去）`7e3e507`〕・回帰テスト +2）。直前: 2026-07-18 CodeRabbit 指摘対応 Phase 1 完了 — Stripe PaymentIntent の冪等キー付与 [`ae585a7`] / 決済状態更新の CAS 化（webhook との退行レース解消）[`c77cdd7`] / `saveUserCart` の P2034 再試行 [`d8108b5`/`e5903c8`] / `emptyCart()` 失敗時の注文遷移継続 [`f4aba5f`] / 空 `it.each([])` の計数是正 [`b5eb8d1`]）。直前: improve Round 13 P2 プラン完了 — plan 061: レスポンス強化ヘッダ 5 種を全ルートへ付与 + E2E 厳密値ガード [`4e2c4fa`/`afd22b3`] / plan 062: `index-products` の生 `error.message` 漏洩停止 + `error: any` 撤去 [`5ef0dfe`/`492e9ac`]）。その前: Round 13 P1 全 4 プラン完了 — plan 057: `next` を ~16.2.10 へ bump [`10e35f3`] / plan 058: `getCoupon` IDOR read 修正 [`15c9a96`] / plan 059: PayPal capture の金額/相関/通貨検証 + settled ガード [`6a31da1`] / plan 060: クーポン mutation のサーバー側 Zod 検証 — discount>99 → 負値 total 防止 [`c67b833`]

---

## 現在の実装状態サマリ

### テスト統計（テスト数・lcov カバレッジとも 2026-07-27 実測・`bun run test -- --coverage`）

> **記載ルール（2026-07-10 整理）**: このテーブルは**最新値のみ**を保持する。増減の経緯・
> 機能実装の詳細ナラティブは [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) が
> アーカイブ先（日付・コミット付きで全件記録済み）。本テーブルのセルに履歴長文を追記しないこと。

| 指標 | 値 |
|------|-----|
| Jest テスト総数 (unit/component) | **1761** passed / 1764 total / 175 スイート（174 passed + 1 skipped suite）。2026-07-27 に CodeRabbit レビュー（4 巡目）対応の回帰 +7 — `coupon.test.ts` +4（検証エラー / コード重複エラーが catch の `Error occurred while ...` で上書きされていた欠陥を完全一致でアンカー・seller / admin 両経路 + logError 不発火）、`scan-tests.test.ts` +3（`test.skip(` が testCount から漏れる欠陥 + 過大計上ガード 2 件）。スイート・スナップショットは不変 |
| カバレッジ全体（lcov 2026-07-27 実測） | Statements 66.18% / Branches 46.26% / Functions 54.69% / Lines 65.17% |
| Jest Integration テスト総数 | **17** / 2 スイート（`cart-checkout.test.ts` 11 + `order-placement.test.ts` 6）。`bun run test:integration`（testcontainers + 専用 config）で実行、`bun run test` の集計外。**2026-07-11 実測: 17/17 pass / 4.779s**（Round 4 時点の「Docker 停止により未実測」を解消）。**同日 Round 6 冒頭に 17/17 pass / 4.008s、Round 7 冒頭に 17/17 pass / 4.473s を再実測**（いずれもソース無変更の確認込み）。**2026-07-17: ダッシュボードの `integration × queries` が 14 と表示され本行の 17 と乖離していた問題を解消**（`scan-tests.ts` が `it.each` を 0 件と数えていた静的走査の欠陥。`c1be6d7` で展開対応し 14→17 で一致） |
| Jest スナップショット | **127**（`tests/component/ui/__snapshots__/`・49/49 shadcn/ui プリミティブカバー） |
| Playwright E2E（main） | **10 スペック**（purchase-flow / seller-onboarding / payment-error / search-filter / mobile-responsive / platform-coupon / stock-decrement / messages / layout-chrome / **security-headers** 🆕 2026-07-18 plan 061）。Clerk 依存 spec は `CLERK_SECRET_KEY` 未設定時に自動 skip。**2026-07-11 初のフル実測（3 ブラウザ 111 テスト / `run-local.sh` + `--global-timeout=3600000` / 25.5m）: 52 passed / 17 failed / 39 skipped / 3 did not run** — 認証系の失敗は **13 件**（各 3 リトライ込みで wall-clock を押し上げた主因）。findings-16 の「16 instance」は 13 + 別カウント 3 の**合計**であって別の母数ではない —— 見積りの前提が読めなくなるため両者を混在させず、**13 件**に統一する（[`plans/044`](../../plans/044-e2e-run-guardrails.md) の根拠値定義に従う）。原因は signIn ヘルパーの Clerk UI ドリフト単一（**plan 042 で修復予定**。skip 39 の内訳 = 静的 18 + a11y/visual の chromium 限定 14 + firefox ローカルゲート 7。詳細: [`plans/audit/findings-16-e2e-coverage.md`](../../plans/audit/findings-16-e2e-coverage.md)）。**2026-07-18: `security-headers.spec.ts` を 3 ブラウザ実測で 6/6 pass**（Clerk 非依存・`request` フィクスチャのみ使用のため常時実行可能）。**2026-07-27: ダッシュボードの `e2e × pages` が 23 と表示され本行の 37（= 111 ÷ 3 ブラウザ）と乖離していた問題を解消**（`scan-tests.ts` の `BLOCK_PATTERN` が `test.skip(` を拾わず skip 14 件を 0 件と数えていた静的走査の欠陥。`8637bca5` で修飾子を列挙形で許容し 23→37 で一致。`it.each` の欠陥〔`c1be6d7`〕と同型の再発） |
| Playwright Visual | **2 スペック**（cart / checkout）。2026-07-11 実測: **3 テストともベースライン陳腐化で failed**（cart-empty は高さ 720→1071px。plan 043 で目視ゲート付き再撮影予定） |
| Playwright a11y | **4 スペック**（sign-in / seller-apply / checkout / profile）。2026-07-11 実測: seller-apply のみ passed。sign-in は**実 WCAG 違反 svg-img-alt**（フッター SendIcon — plan 042 で是正）、checkout / profile は signIn ドリフトで fail |
| 型エラー | **0 件** |
| Skipped テスト | **3 件**（idempotency suite 3 件 [`prisma/seed/__tests__/idempotency.test.ts` を `SKIP_DB_TESTS` 環境変数で `describe.skip`]）。modal-provider 9 件は 2026-06-14 に un-skip 済み（OI-8 解消）。Playwright a11y spec は別系統で `CLERK_SECRET_KEY` 未設定時に `test.skip` 条件分岐 |
| Skipped スイート | **1 件**（idempotency suite のみ。modal-provider.test.tsx の file-level skip は OI-8 解消で解除） |

> **恒久メモ（Unit 行・Integration 行の到達点）**: Unit 行は `queries / pages / store / dashbd /
> shared / lib` が ✦、`api` は構造的 N/A（categorize 上 api-contract 固定・実カバーは API/Contract 行 ✦
> が担保）、`seed` は logic-centric 分母の意図的対象外（2026-05-31 確立）。Integration 行は
> testcontainers 実 PostgreSQL 基盤（ADR-004）+ `integration × queries` 分類（D1, `b57841a`）。
> 各到達の経緯・追加テスト一覧は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) の
> 2026-05-29〜06-02 エントリを参照（本ファイルの詳細セクションは 2026-07-10 に重複整理で削除）。

---

## フェーズ別実施状況

### ✅ Phase 1（基盤ロジック・ユーティリティ）— 完了

| ステップ | 対象 | ファイル | 状態 |
|---|---|---|---|
| 1-1 | middleware.ts | `src/middleware.test.ts` | ✅ 完了 |
| 1-2 | country.ts | `src/lib/country.test.ts` | ✅ 完了 |
| 1-3 | sanitize.ts | `src/utils/sanitize.test.ts` | ✅ 完了 |
| 1-4a | useIsMobile | `src/hooks/use-mobile.test.tsx` | ✅ 完了 |
| 1-4b | useToast reducer | `src/hooks/use-toast.test.ts` | ✅ 完了 |
| 1-4c | useFromStore | `src/hooks/useFromStore.test.tsx` | ✅ 完了 |
| 1-5 | modal-provider | `src/providers/modal-provider.test.tsx` | ✅ 完了 |
| 1-6 | utils.ts (cn + DOM) | `src/lib/utils.test.ts` / `tests/component/utils-dom.test.ts` | ✅ 完了 |

### ✅ Phase 2（UI コンポーネント）— 完了

| ステップ | 対象コンポーネント | ファイル | 状態 |
|---|---|---|---|
| Step 10 | ステータスタグ群 | `tests/component/shared/status-tags.test.tsx` | ✅ 完了 |
| Step 11 | ProductPrice | `tests/component/store/product-price.test.tsx` | ✅ 完了 |
| Step 12 | ProductShippingFee | `tests/component/store/shipping-fee.test.tsx` | ✅ 完了（2026-03-23） |
| Step 13 | SizeSelector | `tests/component/store/size-selector.test.tsx` | ✅ 完了 |
| Step 14 | QuantitySelector | `tests/component/store/quantity-selector.test.tsx` | ✅ 完了 |
| Step 15 | CartProduct | `tests/component/store/cart-product.test.tsx` | ✅ 完了 |
| Step 16 | ApplyCouponForm | `tests/component/store/apply-coupon-form.test.tsx` | ✅ 完了 |
| Step 17 | PlaceOrderCard | `tests/component/store/place-order-card.test.tsx` | ✅ 完了 |
| Step 18 | OrderStatusSelect | `tests/component/dashboard/order-status-select.test.tsx` | ✅ 完了 |
| Step 19 | ProductStatusSelect | `tests/component/dashboard/product-status-select.test.tsx` | ✅ 完了 |
| Step 20 | StoreStatusSelect | `tests/component/dashboard/store-status-select.test.tsx` | ✅ 完了 |
| Step 21 | CountrySelector | `tests/component/shared/country-selector.test.tsx` | ✅ 完了 |
| F1-1 | StatsCards (admin dashboard) | `tests/component/dashboard/admin/stats-cards.test.tsx` | ✅ 完了 |
| F1-2 | RecentOrders (admin dashboard) | `tests/component/dashboard/admin/recent-orders.test.tsx` | ✅ 完了 |
| F1-3 | SalesChart (admin dashboard) | `tests/component/dashboard/admin/sales-chart.test.tsx` | ✅ 完了 |
| F1-4 | RecentStores (admin dashboard) | `tests/component/dashboard/admin/recent-stores.test.tsx` | ✅ 完了 |

### ⚠️ Phase 3（E2E テスト）— スケルトン完了・一部保留

| ステップ | ファイル | 状態 | 備考 |
|---|---|---|---|
| Step 22 | `tests/e2e/purchase-flow.spec.ts` | ✅ 8/8 テスト | 「複数バリアント追加」を 2026-05-22 に追加（OI-2 解消） |
| Step 23 | `tests/e2e/seller-onboarding.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 24 | `tests/e2e/payment-error.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 25 | `tests/e2e/search-filter.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 26 | `tests/e2e/mobile-responsive.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |

### ✅ A1（認可テスト横展開）— 完了（2026-05-21）

- `docs/testing/SECURITY_GAP_REPORT.md` で 14 ファイルの認可カバレッジを調査・記録
- `review.test.ts` に IDOR レグレッションテストを追加
- `paypal.ts` / `stripe.ts` の IDOR 脆弱性（orderId 所有権チェック欠落）を修正 → テスト有効化
- 参照コミット: `55c07b1`, `03a7e89`, `37754d9`, `217bf76`

### ✅ A4（認可ガード統合 + IDOR テスト 3 階層化）— 完了（2026-05-24）

- **認可ガード統合 (`src/lib/auth-guards.ts`)**: `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner` を導入し、`category` / `subCategory` / `offer-tag` / `coupon` / `product` / `store` の各 Server Action からインライン認可チェックを撤去。エラーメッセージを SSOT 化（"Forbidden: store not owned by current user." 等）。
- **CSRF 防御方針 (ADR 001)**: Next.js 16 Server Actions の Origin/Host 検証 + Clerk SameSite=Lax Cookie に依拠する方針を採択。明示的トークン実装は導入しない。`specs/multi-vendor-ecommerce/06-quality.md` / `.claude/steering/tech.md` に明文化。
- **IDOR テスト 3 階層化**: 既存の「(a) スロー検証」に加え、「(b) `where: { url, userId }` 構造検証」「(c) ガード失敗時の副作用なし検証（下流の `upsert` / `create` / `delete` / `findMany` 非呼び出し）」を 8 件追加 (`product.test.ts` +4 / `coupon.test.ts` +1 / `store.test.ts` +3)。
- 参照コミット: `a73603e` 〜 `eae2cfe`

### ✅ A2（Visual Regression MVP）— 完了（2026-05-22）

- `tests/e2e/visual/cart.spec.ts` / `checkout.spec.ts` を追加（chromium 限定）
- `playwright.config.ts` に `reducedMotion: 'reduce'` / `locale: 'en-US'` / `timezoneId: 'UTC'` を追加
- baseline スクリーンショット 3 枚をコミット済み（`688225f`）
  - `cart.spec.ts-snapshots/cart-empty-chromium-darwin.png`
  - `cart.spec.ts-snapshots/cart-with-item-chromium-darwin.png`
  - `checkout.spec.ts-snapshots/checkout-redirect-signin-chromium-darwin.png`
- ⚠️ **CI（Linux）では `-linux.png` baseline が別途必要**（詳細は `specs/multi-vendor-ecommerce/07-testing.md §Visual Regression`）
- 参照コミット: `f639334`, `688225f`

### ✅ A3（a11y MVP）— 完了（2026-05-21）

- `tests/e2e/a11y/sign-in.spec.ts` / `seller-apply.spec.ts` を追加
- `@axe-core/playwright` で WCAG 2.1 AA スキャン
- 参照コミット: `d261d76`

---

## 残課題・Open Issues

### 🔴 現在アクティブな残課題（優先度順・2026-07-26 時点） {#active-open-issues}

> 解消済み OI（OI-1〜OI-9）は下表に取り消し線付きで監査証跡として残す。**着手すべきは以下 3 件（OI-11 / OI-10 / C2）。**

| 優先 | ID | 課題 | 期限 / 状態 | 次の一手 |
|---|---|---|---|---|
| ~~1~~ | ~~**OI-9**~~ | ~~ホーム `/` が SSR で 500（`featured.tsx` の `window` 初期化子参照）~~ | ✅ **解消済み（2026-06-06 / `c196e3d5`）** | 実装は `useState<number>(1200)` の安全な既定値 + `useEffect` での実測反映済み（`featured.tsx:19,30`）。**実測（2026-07-26）**: `security-headers.spec.ts` の `/` が 3 ブラウザとも `status < 400` で pass。**次の一手は D2** — `.lighthouserc.json` / `lhci.yml` の計測 URL へ `/` を追加できる状態になった。 |
| **1（最優先）** | **OI-11** | `/dashboard/seller` 系ルートが本番 SSR で `ReferenceError: self is not defined`（`next-cloudinary` の `CldUploadWidget` をサーバ評価）。OI-9 と同族の client-only ref 問題。現状テストは落ちていない（ログのみ）が本番でも再現の可能性 | 🟡 未着手 | `image-upload.tsx` の `CldUploadWidget` を `next/dynamic` の `ssr:false` で遅延 import する。発見: 2026-06-19（E2E 本番ビルド化で顕在化） |
| 2 | **OI-10** | a11y `color-contrast` 負債: `/checkout`・`/profile`・`/seller/apply` でグレー/ブルー系テキストが 4.5:1 未満。E2E では `runA11yScan` の `disabledRules:["color-contrast"]` で抑制中（追跡のため意図的） | 🟢 低 | 配色（テキスト色）を是正して `disabledRules` を解除する。発見: 2026-06-19（a11y readiness 修正で axe 到達後に検出） |
| 3 | **C2** | Bundle Size の継続監視 | 🟢 低 | `@next/bundle-analyzer + size-limit` で初期 JS の閾値超過を CI 警告（下記 C2 プロンプト参照）。 |

> ✅ **OI-8 完了（2026-06-14）**: CI flake の真因は `src/queries/size.test.ts` の `@/lib/db` 未モックによる実 Prisma 接続リーク（stub DB へ P1001 → jest-circus が別ファイルへ「本文空」失敗を帰属）。`size.test.ts` に `jest.mock("@/lib/db")` を追加して根絶（`83ef06c`）→ 被害者だった `modal-provider.test.tsx` 9 件を un-skip（`49fa32d`、1272→1281 / skip 12→3）。CI push/pull_request 両 event × 2 サイクル緑・stub DB フルスイート P1001 = 0。詳細: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)。
>
> ✅ **D1 完了（2026-06-02）**: ダッシュボード Integration 行の誤分類（`tests/integration/` が `unit × other` セルに分類）は `categorize.ts` 改修で恒久解消（commit `b57841a`）。`integration × queries` ◯→◐（lcov に同名ソース無しのため partial）。詳細: [`COVERAGE_REPORT.md §3 D1`](./COVERAGE_REPORT.md)。

---

### 📜 Open Issues 監査証跡（解消済み含む全履歴）

| # | 課題 | 優先度 | 備考 |
|---|---|---|---|
| ~~OI-1~~ | ~~Visual Regression baseline 未コミット~~ | ~~🔴 高~~ | ✅ 解消済み（`688225f`） |
| ~~OI-2~~ | ~~`purchase-flow.spec.ts` の「複数バリアント追加」1テスト保留~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`tests/e2e/seed/constants.ts` に第2バリアント追加 + spec 追加） |
| ~~OI-3~~ | ~~`/checkout` / `/profile` の a11y spec 未追加~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`tests/e2e/helpers/auth.ts` + `tests/e2e/a11y/{checkout,profile}.spec.ts`。`CLERK_SECRET_KEY` 未設定時は自動スキップ） |
| ~~OI-4~~ | ~~`.github/workflows/` CI 未整備~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`.github/workflows/ci.yml` に lint/test/build 3 並列ジョブ） |
| ~~OI-4a~~ | ~~CI で Visual Regression の `-linux.png` baseline 生成~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`ci.yml` に `workflow_dispatch` 起動の `visual-baselines` ジョブ追加。`gh workflow run ci.yml --ref <branch>` で起動 → 自動 PR） |
| ~~OI-5~~ | ~~E2E シード冪等性（CI 環境での `seed:e2e`）~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`ci.yml` の `seed-idempotency` ジョブで PG service container 起動 → seed 2回実行 → 行数 diff 検証） |
| ~~OI-6~~ | ~~`DashboardStats` コンポーネント調査未完了~~ | ~~🟢 低~~ | ✅ 解消済み（2026-05-24、調査結果: ソース・仕様ともに該当コンポーネントなし。`src/app/dashboard/{admin,seller}/.../page.tsx` はプレースホルダー、`specs/multi-vendor-ecommerce/04-interfaces.md` も「overview」と記載のみ。統計 UI 要件は将来の機能追加時に `specs/` で別途起票） |
| ~~OI-7~~ | ~~`coverage/lcov.info` が古い (2025-03-16 時点)~~ | ~~🟢 低~~ | ✅ 解消済み（2026-05-24、`/coverage` は `.gitignore:10` 対象で git 管理外。`bun run test -- --coverage` でローカル再生成 → `bun run coverage:dashboard` で `docs/coverage-dashboard.html` を更新する運用を確認。CI でのカバレッジ自動化は [`COVERAGE_REPORT §3 B4`](./COVERAGE_REPORT.md#b4-ci-でのカバレッジ-artifact-化--dashboard-自動再生成) に移管 → **B4 完了（2026-06-03）**: `ci.yml` の `test` ジョブで `bun run coverage:dashboard` を実行し `docs/coverage-dashboard.html` を `coverage-dashboard` artifact 化。`generatedAt` の churn 回避のため自動コミットはせず artifact 化に限定） |
| ~~OI-9~~ | ~~**ホーム (`/`) が SSR で 500**: `featured.tsx` の `useState<number>(window.innerWidth)` が初期化子で `window` を参照し、`"use client"` でも SSR 実行時に `ReferenceError: window is not defined` を投げる~~。発見: 2026-05-30 (C1 検証中) | ✅ 解消済み（2026-06-06） | **修正**: `c196e3d5` が初期化子を安全な既定値 `useState<number>(1200)` に置き換え、`useEffect` で実測幅を反映する形にした（現行 `featured.tsx:19,30`）。ハイドレーション差分は `17dfa9f4` の `mounted` ゲートで併せて解消。**実測（2026-07-26）**: `security-headers.spec.ts` の `/` が 3 ブラウザとも `status < 400` で pass し、SSR 200 を確認。**追跡漏れの経緯**: 修正から本行のクローズまで約 7 週間ドリフトしていた（`1fd0a9ef` で E2E の `/checkout` 404 を調査した際に発覚）。**残作業は D2 のみ** — `.lighthouserc.json` / `lhci.yml` の URL へ `/` を追加する。 |
| ~~OI-8~~ | ~~CI flake（本文空・ローカル緑/CI赤・失敗テストがランダム移動）~~。真因確定 + 解消 2026-06-14 | ✅ 解消済み（2026-06-14） | **真因確定（2026-06-14）**: `src/queries/size.test.ts` が `@/lib/db` をモックせず実 Prisma を `spyOn` していたため、CI の stub `DATABASE_URL` へバックグラウンド接続が `PrismaClientInitializationError`(P1001) で reject。その非同期 reject が同一ワーカーのプロセス境界をまたいでリークし、jest-circus が「その瞬間 current な別ファイルのテスト/フック」に `error` イベントとして帰属（P1001 の stack getter が空のためレポーターが本文を空に整形 → 「本文空」署名）。modal-provider / shipping-form / review-details はいずれも Prisma 非依存の**被害者**だった。**過去の仮説の誤り**: 仮説 A(isMounted)/B(MSW)/workflow 層はいずれも対症療法。`[FLAKE-DIAG:unhandledRejection]`(`0736735`) が沈黙したのは、真因が process の unhandledRejection ではなく jest-circus の `error` イベントだったため。**実観測手段**: 一時カスタム jsdom 環境の `handleTestEvent` で失敗イベントの生エラーを surface（`a93effe`、撤去 `756c6a9`）→ 3× P1001 を捕捉（失敗 push run `27487047124`）。**修正**: `size.test.ts` に `jest.mock("@/lib/db")` 追加（`83ef06c`）。stub DB のフルスイートで P1001 が 6+→0、review-details は CI push/PR 両 event × 2 サイクル緑で確認。**完了（2026-06-14）**: 被害者だった `modal-provider.test.tsx` 9 件を un-skip（`49fa32d`）→ CI push/pull_request 両 event 2 サイクル緑 → `spec-sync-after-test`（passed 1272→1281 / skip 12→3）。手順全文（アーカイブ）: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)。 |

---

## 次回セッション 推奨着手順

> **このファイルが即時 TODO の Single Source of Truth。**
> 中長期タスク（B1〜C2）の戦略的背景は [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) を参照。

### ✅ 完了

全ての優先 OI（OI-2 / OI-3 / OI-4 / OI-4a / OI-5）は 2026-05-22 に解消済み。
**B1（shadcn/ui プリミティブ Snapshot）** は 2026-05-23 に MVP 9 プリミティブ分を完了（40 snapshot）。
**A4（認可ガード統合 + IDOR 3 階層化）** は 2026-05-24 に完了（テスト総数 990 → 1016、+26 件）。**A4 残課題 `getStoreOrders` 統合** は 2026-05-26 にクローズ（`70f5b94`、テスト総数 1015 → 1016 / +1）。
**B1+ Sprint 1（Tier 1 前半 10 プリミティブ）** は 2026-05-26 に完了（`b55e177`〜`66fb8d5`、テスト総数 1016 → 1042 / +26、snapshot 40 → 66 / +26）。
**B1+ Sprint 2（Tier 1 後半 11 プリミティブ）** は 2026-05-28 に完了（`750d830`〜`45c339b`、テスト総数 1042 → 1069 / +27、snapshot 66 → 93 / +27）。
**B1+ Sprint 3（Tier 2 全 8 プリミティブ）** は 2026-05-28 に完了（`e6c79e3`〜`4429b8b`、テスト総数 1069 → 1088 / +19、snapshot 93 → 112 / +19）。
**B1+ Sprint 4（Tier 3 + 補助 全 11 プリミティブ）** は 2026-05-28 に完了（`1b207ba`〜`8e429f2`、テスト総数 1088 → 1103 / +15、snapshot 112 → 127 / +15）。**B1+ 全完了**：49/49 shadcn/ui プリミティブが snapshot テストでカバーされ、NA-NS-01 をアーカイブ化。

### 残課題

- 現在、アクティブな残課題は **OI-11 / OI-10 / C2** の 3 件です（優先度・次の一手は[アクティブな残課題テーブル](#active-open-issues)を SSOT として参照）。**OI-9（ホーム `/` の SSR 500）は 2026-06-06 に解消済み**（`c196e3d5`。2026-07-26 に E2E 実測でクローズ確認）。**OI-8（CI flake）は 2026-06-14 に解消済み**（真因 = `size.test.ts` の Prisma 接続リーク `83ef06c` + modal-provider un-skip `49fa32d`。経緯: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)）。
- 中長期タスクは [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) の B / C グループに集約。

### 🟢 中長期（COVERAGE_REPORT §3 B/C グループ）

- ~~**B1** shadcn/ui プリミティブの Snapshot~~ ✅ MVP 完了（2026-05-23、9 プリミティブ / 40 snapshot）
- ~~**B1+** shadcn/ui プリミティブ Snapshot 拡張~~ ✅ **全完了（2026-05-28）**。Sprint 1 (Tier 1 前半 10) + Sprint 2 (Tier 1 後半 11) + Sprint 3 (Tier 2 全 8) + Sprint 4 (Tier 3 + 補助 全 11) で **49/49 プリミティブ・127 snapshot**。NA-NS-01 をアーカイブ化
- ~~**B2** Stripe / PayPal Webhook の Contract テスト拡充~~ ✅ **完了（2026-05-28）**。`/api/webhooks/stripe` / `/api/webhooks/paypal` ハンドラーを新規実装し、payment_intent.succeeded/failed/charge.refunded と PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED を冪等処理。30 ケース + metadata 検証 2 ケースで網羅
- ~~**B3** Cart → Checkout の Integration テスト~~ ✅ **完了（2026-05-29）**。`tests/integration/cart-checkout.test.ts` で 4 シナリオ計 11 テストを実装：Zustand persist hydration（2）/ shipping fee 一貫性 ITEM/WEIGHT/FIXED（3）/ クーポン適用（5 正常+異常）/ 未認証リダイレクト（1）。基盤として testcontainers PostgreSQL + 専用 jest config を新設（ADR-004）
- ~~**C1** Lighthouse CI（パフォーマンス予算化）~~ ✅ **完了（2026-05-30）**。`.github/workflows/lhci.yml` + `.lighthouserc.json` を新設し、`@lhci/cli` で `/browse` の LCP/CLS/TBT を計測（warn-only ベースライン）。Clerk は pk_live ダミーで dev handshake を回避。ホーム `/` は OI-9（featured.tsx SSR window バグ）で除外
- **C2** Bundle Size 継続監視（🟢 低）
- ~~**D1** ダッシュボード `categorize.ts` 改修：`tests/integration/` を Integration 行へ正しく分類~~ ✅ **完了（2026-06-02）**。`unit × other` 誤分類を恒久解消し `integration × queries` ◯→◐（commit `b57841a`）
- **D2** Performance 行の着手（🟡 中 / cost M）：**前提だった OI-9 は解消済み**（2026-06-06 `c196e3d5` / 2026-07-26 実測確認）。lhci 計測 URL に `/` を追加 → warn→error 化で予算厳格化。**着手可能**
- **R4** テストギャップ解消（🟡 中 / cost S〜M ×5）：improve Round 4 監査（2026-07-10）の実行プラン **plans/026〜030**（paypal エラー分岐 / placeOrder オーバーセル+PLATFORM 端数統合 / country.ts 新設 / profile.ts catch 分岐 / money-path コンポーネント 6 本）。進捗は [`plans/README.md`](../../plans/README.md) の status 列が SSOT。着手プロンプトは本ファイル「次回着手用 依頼プロンプト」R4 を参照

詳細は [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) を参照。D2 の着手プロンプトは本ファイル「次回着手用 依頼プロンプト」を参照。

---

## 主要コミット履歴

> 2026-07-10 整理: 旧「主要コミット履歴（2026-05-21〜28）」テーブル（62 行）は
> [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) と重複していたため削除。
> コミット単位の履歴は §7（日付・コミットハッシュ付き）と `git log` を参照。

---

## 次回着手用 依頼プロンプト

> **使い方**: 新しいセッションを開いて以下の **コードブロック内の文字列をそのままコピペ** すれば、文脈再構築なしに該当タスクへ着手できます。
> プロンプトは `coverage-dashboard.html §03 Next Actions` (= `scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS`) と一対一で対応しています。
> **更新規約**: タスクを完了したら、対応するプロンプトをこのセクションから削除し、`render-html.ts` の `NEXT_ACTIONS` からも同時に削除する（SSOT 二重管理を防ぐ）。新規タスクを追加する場合は両方に同時追加する。

### 🔴 Immediate (high)

（現在 high 優先度の Next Action はありません。A4 残課題 `getStoreOrders` 統合は `70f5b94` でクローズ済み）

### 🟡 Next Sprint (medium)

<!-- NA-NS-01 (B1+ shadcn/ui Snapshot 拡張) ✅ 完了 2026-05-28: 49/49 プリミティブ / 127 snapshot。詳細: B1_SNAPSHOT_EXPANSION_PLAN.md / COVERAGE_REPORT.md §7 -->
<!-- NA-NS-02 (B2: Stripe/PayPal Webhook Contract テスト) ✅ 完了 2026-05-28: 30+2 ケース。コミット 338ab41 / 1d69f0f / 2321cd8 -->
<!-- NA-NS-03 (B3: Cart → Checkout Integration テスト) ✅ 完了 2026-05-29: 4 シナリオ / 11 テスト。ADR-004 参照 -->
<!-- D1 (categorize.ts 改修 / Integration 行実体化) ✅ 完了 2026-06-02: commit b57841a。詳細: COVERAGE_REPORT.md §3 D1 -->

#### R4: テストギャップ解消（improve Round 4 / plans 026〜030）

2026-07-10 の lcov 実測監査（`plans/audit/findings-12-test-coverage.md`）で特定した
「危険な未テスト箇所」5 件の実行プラン。**各プランは zero-context executor（Sonnet 級）向けに
自己完結**しており、下のプロンプトだけで着手できる。推奨順: 026 → 027 → 028 → 029 → 030
（相互独立・並行可。027 のみ Docker 必須）。

```
plans/026-unit-test-paypal-error-branches.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 本体コード（src/queries/paypal.ts）は変更禁止・テスト追加のみ。各 Step の Verify コマンドを
必ず実行し、STOP conditions に該当したら中断して報告。完了後は spec-sync-after-test skill で
docs 同期（別コミット）を行い、plans/README.md の 026 行を DONE に更新すること。
```

（027〜030 も同形式: パスを `plans/027-integration-test-oversell-rollback-and-platform-coupon.md` /
`plans/028-unit-test-country-query.md` / `plans/029-unit-test-profile-catch-branches.md` /
`plans/030-component-test-money-path-client.md` に差し替えて依頼する）

#### R5: improve Round 5 Integration テストギャップ解消（plans 031〜035）🆕 2026-07-11 起票

2026-07-11 の Integration 特化監査（`plans/audit/findings-13-integration-coverage.md`・
実測 17/17 pass）で特定した「実 DB でしか検証できない未テスト統合面」5 件の実行プラン。
**全プラン Docker 必須**（`docker info` 失敗時は各プラン Step 0 の STOP 条件で BLOCKED 記録）。
推奨順: 031（在庫復元・money-critical）→ 032（webhook 決済）→ 033（tsvector 検索）→
034（レビュー集計）→ 035（ロール昇格）。相互独立・並行可だが、**031 と 027 は両方
`tests/integration/setup/seed.ts` を拡張**するため同時実行時はマージに注意（可能なら 027 → 031 順）。

```
plans/031-integration-test-order-lifecycle-restock.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 本体コード（src/queries/order.ts）は変更禁止・テスト/seedヘルパー追加のみ。Docker 必須
（docker info 失敗時は STOP して BLOCKED 記録）。各 Step の Verify コマンドを必ず実行し、
STOP conditions に該当したら中断して報告。完了後は spec-sync-after-test skill で docs 同期
（別コミット）を行い、plans/README.md の 031 行を DONE に更新すること。
```

（032〜035 も同形式: パスを `plans/032-integration-test-webhook-payment-idempotency.md` /
`plans/033-integration-test-tsvector-search.md` / `plans/034-integration-test-review-aggregation.md` /
`plans/035-integration-test-store-status-role-promotion.md` に差し替え、「本体コード」を各プランの
Out of scope 記載どおり読み替えて依頼する）

#### R6: improve Round 6 Integration 深掘りギャップ解消（plans 036〜039）🆕 2026-07-11 起票

2026-07-11 の Integration 深掘り監査（`plans/audit/findings-14-integration-coverage-r6.md`・
R5 未スイープの切り口: FK/カスケード実セマンティクス・default 不変条件・全置換 tx・browse
フィルタ）で特定した 4 件の実行プラン。**全プラン Docker 必須**・相互独立・
**`tests/integration/setup/seed.ts` を変更しない**ため R4/R5 プラン（027 / 031〜035）とも並行可。
推奨順: 036（deleteProduct FK — セラー障害直結）→ 037（住所 default — checkout 信頼性）→
038（updateProduct 編集フロー）→ 039（browse フィルタ — Prisma 6 回帰網）。
037/039 には**現挙動の characterization**（既知ギャップの固定）シナリオが含まれる —
期待値の反転条件は各プラン本文の STOP conditions / Maintenance notes を参照。

```
plans/036-integration-test-product-deletion-fk.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 本体コード（src/queries/product.ts）と prisma/ は変更禁止・テスト追加のみ。Docker 必須
（docker info 失敗時は STOP して BLOCKED 記録）。各 Step の Verify コマンドを必ず実行し、
STOP conditions に該当したら中断して報告。完了後は spec-sync-after-test skill で docs 同期
（別コミット）を行い、plans/README.md の 036 行を DONE に更新すること。
```

（037〜039 も同形式: パスを `plans/037-integration-test-shipping-address-default.md` /
`plans/038-integration-test-product-update-tx.md` /
`plans/039-integration-test-product-browse-filters.md` に差し替え、「本体コード」を各プランの
Out of scope 記載どおり読み替えて依頼する）

#### R7: improve Round 7 Integration 残余ギャップ解消（plans 040〜041）🆕 2026-07-11 起票

2026-07-11 の Integration 第 3 弾監査（`plans/audit/findings-15-integration-coverage-r7.md`・
R5/R6 未スイープの切り口: Clerk user-sync webhook の FK 連鎖・グローバル unique 制約の実発火）で
特定した 2 件の実行プラン（高レバレッジ候補が 2 件のみだったため水増しせず 2 本 — 詳細な
rejected/deferred 判定は findings-15 参照）。**全プラン Docker 必須**・相互独立・
**`tests/integration/setup/seed.ts` / `setup/reset-db.ts` を変更しない**ため
R4〜R6 プラン（027 / 031〜039）とも並行可。
推奨順: 040（user.deleted FK 連鎖 — PII 残存・Svix 無限リトライのコンプライアンス隣接）→
041（coupon code unique — セラー日常運用のエラー UX）。
040 のシナリオ 2〜4 と 041 のシナリオ 2・3 は**現挙動の characterization**（既知ギャップの固定）—
期待値の反転条件は各プラン本文の STOP conditions / Maintenance notes を参照。

```
plans/040-integration-test-user-deletion-webhook.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 本体コード（src/app/api/webhooks/route.ts）と prisma/ は変更禁止・テスト追加のみ。Docker 必須
（docker info 失敗時は STOP して BLOCKED 記録）。各 Step の Verify コマンドを必ず実行し、
STOP conditions に該当したら中断して報告。完了後は spec-sync-after-test skill で docs 同期
（別コミット）を行い、plans/README.md の 040 行を DONE に更新すること。
```

（041 も同形式: パスを `plans/041-integration-test-coupon-code-uniqueness.md` に差し替え、
「本体コード」を `src/queries/coupon.ts` に読み替えて依頼する）

#### R8: improve Round 8 E2E 網羅性ギャップ解消（plans 042〜050）🆕 2026-07-11 起票

2026-07-11 の初 E2E フル実測 + 網羅性監査（`plans/audit/findings-16-e2e-coverage.md`）で
特定した 9 件の実行プラン。**最優先は 042**（signIn ヘルパーの Clerk UI ドリフトが
5 サイトに複製され認証系 16 テストが全滅中 — 047/048/049/050 の先行依存）。
042 と並行して依存ゼロの 045（ゲスト導線）/ 044（運用ガード）/ 043（VRT）/
046（/browse ページネーション配線）に着手可能。045・046 は同じ
`tests/e2e/seed/` を触るため後発が先発の diff を取り込むこと。
全プラン `CLERK_SECRET_KEY` + ローカル Docker Postgres 前提。**実行前に :3000 を解放**
（`docker compose stop app` — 怠ると別環境のサーバーを無警告で再利用し実測が無効化される。
2026-07-11 実測 #1 の事故として findings-16 に記録済み）。

```
plans/042-e2e-signin-helper-repair.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 変更は In scope のファイルのみ（tests/e2e/ の 5 ファイル + src/components/store/icons/ の
aria-label 追加 3 行）。実行前に lsof -nP -iTCP:3000 -sTCP:LISTEN が空であることを確認し、
占有されていたら docker compose stop app。各 Step の Verify コマンドを必ず実行し、
STOP conditions に該当したら中断して報告。完了後は spec-sync-after-test skill で docs 同期
（別コミット）を行い、plans/README.md の 042 行を DONE に更新すること。
```

（043〜050 も同形式: パスを各プランに差し替える。047〜050 は「plan 042 が DONE であること」を
冒頭で確認し、未完なら BLOCKED 記録で STOP と付記して依頼する）

#### R9: improve Round 9 E2E 残余ギャップ解消（plans 051〜056）🆕 2026-07-12 起票

2026-07-12 の E2E 残余監査（`plans/audit/findings-17-e2e-coverage-r9.md` — R8 未スイープの
新規切り口 8 系統を精査。ベースラインは R8 実測 #2 を SSOT 引き継ぎ・再実測なし）で
特定した 6 件の実行プラン。**051（国選択セレクタ — 依存ゼロ・P1）と
056（Newsletter dormant 404 の characterization — 依存ゼロ）は R8 プランを待たず即着手可能**。
052（a11y 拡大）は plan 042 Step 4（svg-img-alt 修正）完了後、055（カート引き継ぎ）と
053 のサインアウト部は 042 全体の完了後、054（VRT 拡大）は plan 043 完了後。
**監査で新規発見したアプリ側ギャップ**: フッター Newsletter フォームの `/api/newsletter` が
**リポジトリに不在**（curl 実測 404・schema に購読者モデルも無し）— 全購読操作が失敗する
dormant 機能。成功系は機能実装プランの起票が先（characterization は plan 056 が担当）。

```
plans/051-e2e-country-selector.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 変更は In scope のファイルのみ（tests/e2e/country-selector.spec.ts 新規のみ・src/ 変更禁止）。
実行前に lsof -nP -iTCP:3000 -sTCP:LISTEN が空であることを確認し、占有されていたら
docker compose stop app。各 Step の Verify コマンドを必ず実行し、STOP conditions に該当したら
中断して報告。完了後は spec-sync-after-test skill で docs 同期（別コミット）を行い、
plans/README.md の 051 行を DONE に更新すること。
```

（052〜056 も同形式: パスを各プランに差し替える。052 は「plan 042 Step 4 完了」、
055 は「plan 042 DONE」、054 は「plan 043 DONE」を冒頭で確認し、未完なら BLOCKED 記録で
STOP と付記して依頼する）

#### D2: Performance 行の着手（lhci の計測 URL に `/` を追加）

```text
ヒートマップ Performance 0% 行を前進させるため、Lighthouse CI の計測対象に / を追加してください。

背景:
- C1（Lighthouse CI）は 2026-05-30 に完了済みだが、ホーム / は OI-9（featured.tsx の SSR window
  参照バグで 500）のため計測対象から除外され、暫定的に /browse のみを計測している。
- その OI-9 は 2026-06-06 に解消済み（c196e3d5 が初期化子を安全な既定値へ置換）。
  2026-07-26 に security-headers.spec.ts の / が 3 ブラウザとも status < 400 で pass することを
  実測し、SSR 200 を確認済み。したがってコード修正は不要で、計測 URL の追加から着手できる。

実装方針:
1. .lighthouserc.json / .github/workflows/lhci.yml の collect URL に / を追加する。
2. 数回ベースライン観測後、.lighthouserc.json の assertion を warn → error 化して予算を厳格化（別 PR 可）。

完了条件:
1. lhci が / を計測（CI グリーン）、bunx tsc --noEmit / bun run lint グリーン。
2. render-html.ts の NEXT_ACTIONS から D2 を削除し、本プロンプトも削除（二重 SSOT 同期）。
3. COVERAGE_REPORT.md §2/§3 を更新（Performance 行の状態変化を反映）。

参考:
- OI-9 のクローズ記録: docs/testing/QA_HANDOFF.md「解消済み OI」OI-9 行
- 先行例: .github/workflows/lhci.yml + .lighthouserc.json（C1）
- コミット規約: .claude/rules/02-tdd-step-commit.md
```

#### OI-11: seller ルートの本番 SSR クラッシュ修正

```text
/dashboard/seller 系ルートが本番 SSR で ReferenceError: self is not defined を投げる問題
（OI-11）を修正してください。next-cloudinary の CldUploadWidget がサーバ評価される client-only
コンポーネントであることが原因です（OI-9 と同族）。

実装方針:
1. image-upload.tsx の CldUploadWidget を next/dynamic の { ssr: false } で遅延 import する。
2. 本番ビルド（next build → next start）で /dashboard/seller 系が SSR 200 を返すことを確認。

完了条件:
1. seller ルートが本番 SSR で 200、OI-11 を QA_HANDOFF.md 残課題からクローズ（取り消し線）。
2. bunx tsc --noEmit / bun run lint グリーン。
3. render-html.ts の NEXT_ACTIONS から OI-11 を削除し、本プロンプトも削除（二重 SSOT 同期）。

参考:
- OI-11 詳細: docs/testing/QA_HANDOFF.md「現在アクティブな残課題」OI-11 行
- 同族先行例: OI-9（featured.tsx の SSR window 参照）
```

### 🟢 Mid–Long Term (low)

SaaS ロードマップ範囲 (docs/architecture/saas-roadmap.md) で別ストリーム扱い。

#### OI-10: a11y color-contrast 負債の是正

```text
/checkout・/profile・/seller/apply のグレー/ブルー系テキストが WCAG 2.1 AA の 4.5:1 を
満たさない a11y 負債（OI-10）を是正してください。現在 E2E では runA11yScan の
disabledRules:["color-contrast"] で追跡のため意図的に抑制中です。

実装方針:
1. 対象ページのテキスト色を 4.5:1 以上を満たす配色へ是正する。
2. runA11yScan の disabledRules から "color-contrast" を解除する。

完了条件:
1. axe color-contrast 違反ゼロ、OI-10 を QA_HANDOFF.md 残課題からクローズ（取り消し線）。
2. E2E a11y spec グリーン（disabledRules 解除後）。
3. render-html.ts の NEXT_ACTIONS から OI-10 を削除し、本プロンプトも削除（二重 SSOT 同期）。

参考:
- OI-10 詳細: docs/testing/QA_HANDOFF.md「現在アクティブな残課題」OI-10 行
```

<!--
C1 (Lighthouse CI でパフォーマンス予算化) は 2026-05-30 に完了済み。
- 結果: .github/workflows/lhci.yml + .lighthouserc.json を新設、@lhci/cli で /browse の
  LCP/CLS/TBT を計測 (warn-only ベースライン)。
- Clerk 回避: pk_test ダミーは dev handshake (偽 FAPI) で collect 400。本番形式の
  pk_live ダミー (+ sk_live ダミー) で handshake を回避 (ローカルで /browse → 200 実証)。
- ホーム / は OI-9 (featured.tsx の SSR window バグ) で 500 のため URL から除外。修正後に追加。
- scripts/coverage-dashboard/render-html.ts の NEXT_ACTIONS からも削除済み。
- フォローアップ: 数回のベースライン観測後に .lighthouserc.json を warn → error 化して予算を厳格化。
-->

#### C2: Bundle Size の継続監視 (`.github/workflows/bundle.yml`)

```text
依存追加による初期 JS バンドルの肥大化を PR で検知するため、Bundle Size 継続監視を導入してください。

背景:
- C1 (Lighthouse CI) は 2026-05-30 に完了済み (.github/workflows/lhci.yml + .lighthouserc.json)。
  C2 は同じ "パフォーマンス退行を PR で検知する" ストリームの 2 件目 (COVERAGE_REPORT.md §3)。
- 目的: @next/bundle-analyzer + size-limit で初期ロード JS の閾値超過を CI で警告する。
- コスト感: S (lhci 比で軽量。サーバー起動・DB seed 不要)。

実装方針:
1. devDependencies に size-limit + @size-limit/file (または @size-limit/preset-app) を追加。
2. .size-limit.json を新設し、.next/static/chunks の主要バンドル (app shell / framework) に
   閾値 (例: gzip 後 KB) を設定。初期は warn 相当の緩い閾値でベースライン観測。
3. .github/workflows/bundle.yml を新設:
   - on: pull_request [main, dev] + workflow_dispatch
   - permissions: contents: read / concurrency: bundle-${{ github.ref }}
   - third-party action は SHA ピン + バージョンコメント (01-engineering-standards.md)。
     postgres service は不要 (bundle はビルド成果物のサイズのみ計測)。
   - steps: checkout → setup-bun (1.3.14) → bun install --frozen-lockfile →
     bunx prisma generate → bun run build → bunx size-limit
   - env: ci.yml と同じ stub 群 (DATABASE_URL は build 時の force-dynamic 回避用 stub で可)。
4. ビルドが DB に到達しないことを確認 (force-dynamic ページは build 時クエリを実行しないが、
   念のため lhci と同様 stub DATABASE_URL を渡す)。

完了条件:
1. .github/workflows/bundle.yml + .size-limit.json + package.json/lockfile をコミット。
2. bunx tsc --noEmit エラーゼロ、bun run lint グリーン。
3. scripts/coverage-dashboard/render-html.ts の NEXT_ACTIONS から C2 を削除。
4. 本セクション (QA_HANDOFF.md C2 プロンプト) を削除し、COVERAGE_REPORT.md §3 に
   C2 完了アーカイブ行を追加 (完了日 + commit hash)。
5. docs/coverage-dashboard.html を bun run coverage:dashboard で再生成。
6. docs/PROGRESS.md の「次アクション」を更新 (C シリーズ完了)。

参考:
- 先行例: .github/workflows/lhci.yml (C1。トリガー/ピン/concurrency/env のパターン)
- コミット規約: .claude/rules/02-tdd-step-commit.md (実装とドキュメント同期は別コミット)
- ドキュメント配置: .claude/steering/documentation-guide.md
```

---

*Stay Red, Go Green, and Refactor rigorously.*
