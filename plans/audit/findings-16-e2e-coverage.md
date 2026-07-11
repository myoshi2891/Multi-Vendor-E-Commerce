# Findings 16 — E2E テスト網羅性監査（Round 8 / vetted）

> **Round 8**（2026-07-11 / 監査対象 HEAD `fbd1020` / branch `dev` — R7 クローズコミット。
> R7 クローズ時に `src/ tests/ prisma/` の diff 空を検証済み）。
> `tests` フォーカス・**E2E（Playwright）限定**。全 Round を通じて初の 3 ブラウザフル実測 +
> 網羅性監査。
> **方法**: `scripts/e2e/run-local.sh`（ローカル Docker Postgres → `migrate deploy` → `seed:e2e` →
> `--retries=2`）で 3 ブラウザ 111 テストをフル実測 → 失敗の根本原因を error-context /
> trace 出力から直接 vet → 既存 15 spec とギャップ候補 UI（testid・handler）を直接読解でスイープ。
> **全所見を本体が直接コード・ログ・失敗時ページスナップショットを開いて vet 済み**
> （サブエージェント不使用）。

## ベースライン実測（2026-07-11 / Round 8 冒頭）

### 実測 #2 = クリーンラン（**本ラウンドの SSOT**）

| 指標 | 値 |
|---|---|
| 結果 | **52 passed / 17 failed / 39 skipped / 3 did not run**（111 total / exit 1） |
| 実行時間 | **25.5m**（`next build` 本番ビルド起動込み・1 worker 直列） |
| 実行コマンド | `bash scripts/e2e/run-local.sh --global-timeout=3600000`（config の 1200s を CLI 上書き） |
| 前提 | `multivendor-app-dev` コンテナ停止（:3000 解放）・`CLERK_SECRET_KEY` 設定済み |

**17 failed の分解**（3 種の根本原因に収束 — 詳細は TESTS-26/27/28）:

| 根本原因 | 該当失敗 | 件数 |
|---|---|---|
| TESTS-26: `signIn()` ヘルパーの Clerk UI ドリフト | messages ×3 / platform-coupon ×3 / seller-onboarding `:74` ×3 / stock-decrement ×2（firefox はローカルゲート skip）/ a11y checkout・profile（chromium） | **13** |
| TESTS-27: `svg-img-alt` 実 WCAG 違反 | a11y sign-in（chromium） | **1** |
| TESTS-28: VRT スナップショット陳腐化 | visual/cart ×2 + visual/checkout ×1（chromium） | **3** |

**3 did not run** = seller-onboarding 2 本目「管理者が店舗を ACTIVE に変更」×3 ブラウザ
（`seller-onboarding.spec.ts:12` の `test.describe.serial` により 1 本目失敗で打ち切り —
実体は TESTS-26 の連鎖）。

**39 skipped の内訳**（すべて意図された skip — CLERK ゲートは発火していない）:

| 分類 | 件数 |
|---|---|
| 静的 `test.skip`（payment-error 3 + search-filter 1 + mobile-responsive 2）× 3 ブラウザ | 18 |
| a11y 4 spec の chromium 限定（firefox/webkit で skip） | 8 |
| visual 3 テストの chromium 限定 | 6 |
| firefox ローカルゲート `!process.env.CI`（purchase-flow 5 + mobile-responsive 1 + stock-decrement 1） | 7 |

### 実測 #1 = **無効**（環境汚染 + タイムアウト打ち切り。教訓として記録）

- 同日 17:13–17:33 の初回実測は `43 passed / 15 failed / 35 skipped / 18 did not run` で
  **status: timedout**（`playwright.config.ts:10` の `globalTimeout: 1200s` に到達し打ち切り）。
- さらに `multivendor-app-dev` コンテナが :3000 を公開したまま実測しており
  （`run-local.sh:24-26` の「:3000 の既存サーバーを停止すること」前提の不履行）、
  Playwright 自前の `next start` と Docker port proxy が IPv4/IPv6 で併存。コンテナ内
  `CLERK_SECRET_KEY` はホスト `.env` と**不一致**（sha256 ハッシュ比較で確認）で、
  サーバーログに `Error saving user cart: Unauthenticated.` が多発した。
- ただし実測 #2 で同一の失敗群が再現したため、**認証系失敗の主因は環境汚染ではなく
  TESTS-26**（環境汚染は付随ノイズ）。運用ガード欠如そのものは TESTS-29 として起票。

### 実測が確定した「実効カバレッジ」

パスしているのは **ゲスト導線のみ**: purchase-flow のカート CRUD・永続化（chromium/webkit）、
search-filter 4 本、layout-chrome 7 本、mobile-responsive の非 skip 分、payment-error の
未認証リダイレクト、a11y seller-apply。**認証を要する E2E（在庫減算・複数店舗クーポン注文・
メッセージング・販売者オンボーディング・a11y checkout/profile）は 1 本も通っていない**。
QA_HANDOFF のテスト統計は E2E を「スペック数」でしか記録しておらず（`QA_HANDOFF.md:21-23`）、
pass/fail の実測記録が存在しないため、この全滅状態は本ラウンドまで不可視だった。

## スコープ定義

- **対象**: `tests/e2e/`（main 9 spec + visual 2 + a11y 4 = 111 テスト instance）のみ。
- **対象外**: unit / component / Integration（R4〜R7 監査済み）・`prisma/seed/__tests__/`。
- **重複回避**: plans 001〜041 は unit/integration 対象であり E2E プランは初。既存プランと
  シナリオ重複なし。TESTS-14（plans/README Deferred のゲスト E2E）は本台帳 TESTS-33 に昇格。

---

## 新規所見（Round 8・すべて直接 vet 済み）

### [TESTS-26] `signIn()` ヘルパーの Clerk UI ドリフト — 識別子がフッター Newsletter 入力欄へ誤入力され、認証依存 E2E 16 件（13 failed + 3 did not run）が全滅

- **Evidence**: `tests/e2e/helpers/auth.ts:99-113` — `page.goto("/sign-in")` 直後に
  `page.getByLabel("Email address").fill(...)` → `Continue` クリック ×2 →
  `getByRole("button", { name: "Sign in" })` の `toBeHidden({ timeout: 20000 })` 待ち。
- **Evidence（失敗時ページスナップショット）**: `test-results/a11y-checkout-*-chromium/error-context.md`
  — (1) フッター Newsletter の textbox に `e2e-customer-...+clerk_test@example.com` が入力済み、
  (2) Clerk フォームの識別子フィールドは現在 **"Email address or username"** ラベルの
  1 画面統合型（Password 同時表示）で空のまま、(3) Password フィールドには
  `TestP@ssw0rd!...` が正しく入力済み、(4) サインイン未成立でフォーム残存。
- **Evidence**: `src/components/store/layout/footer/newsletter.tsx:64` —
  `<label htmlFor="newsletter-email" className="sr-only">Email address</label>`。
  `/sign-in` はヘッダー/フッター付き（`layout-chrome.spec.ts:47` が仕様として検証）のため、
  本番ビルドでは Clerk ウィジェットのハイドレーション完了前に Newsletter 欄（アクセシブル名
  完全一致）が先に存在し、`getByLabel("Email address")` がそちらへ解決する。
- **Evidence（検出不能の構造）**: `.github/workflows/ci.yml` に Playwright ジョブは無い
  （`:162` の e2e ジョブは seed 冪等性チェックのみ）。`auth.ts` 最終変更は `29050e2`
  （2026-05-22）で、以降フル実測記録なし → 退行の混入時期を特定できる計測が存在しない。
- **Impact**: **認証セッションを前提とする E2E 資産すべてが機能停止**（在庫減算 F3・
  PLATFORM クーポン複数店舗注文 = §20 P0 相当の 2 本を含む）。さらに本台帳の
  TESTS-30/31/34〜38（新規認証系 E2E）は全てこの修復が先行依存。
- **Effort**: S（ヘルパー 1 箇所の locator 堅牢化: Clerk カード内へのスコープ
  `page.locator(".cl-signIn-root")` 等 + ハイドレーション待ち。ただし修正は `tests/` 変更のため
  本ラウンドでは**プラン化のみ**）
- **Risk**: 修正しない場合、E2E の実効範囲はゲスト導線のみに固定され、認証系リグレッションは
  検出されないまま蓄積する。
- **Confidence**: High（失敗時スナップショットで誤入力先を直接確認・2 回の実測で再現）

### [TESTS-27] `/sign-in` の a11y 実違反 `svg-img-alt`（serious）— フッター SendIcon に代替テキスト無し。auth 修復後は checkout/profile a11y も同一違反で fail する

- **Evidence**: 実測 #1・#2 の双方で a11y sign-in が 1.7s で fail、axe 出力
  `{"id":"svg-img-alt","impact":"serious","nodes":1}`（認証不要ページのため環境と無関係）。
- **Evidence**: `src/components/store/icons/send.tsx:14` — `<svg ... role="img">` に
  `aria-label` / `<title>` が無い。`newsletter.tsx:3,17` で `SendIcon` としてフッターに描画され、
  フッターを持つ全ページに露出。a11y seller-apply が pass するのは MinimalHeader 全画面で
  フッターが無いため（`layout-chrome.spec.ts:55` が裏付け）。
- **Impact**: WCAG 2.1 AA 違反（serious）が全ストアフロントページに存在。TESTS-26 を修復して
  checkout/profile の axe スキャンが到達可能になっても、フッター由来の同一違反で fail する
  **直列ブロッカー**。
- **Effort**: S（`aria-label` 追加は 1 行。ただし `src/` 変更のため本ラウンドではプラン化のみ。
  同型 `role="img"` の `wishlist.tsx:16` / `order.tsx:16` も同時是正が妥当）
- **Risk**: 低（表示影響なしの属性追加）
- **Confidence**: High（axe 出力 + 該当 SVG を直接確認）

### [TESTS-28] VRT スナップショット陳腐化 — cart 2 枚 + checkout 1 枚がベースラインとページ実体の乖離で fail

- **Evidence**: 実測 #2 で `visual/cart.spec.ts:51`「空カートの表示」が
  `Expected an image 1280px by 720px, received 1280px by 1071px`（差分 9%）、
  `visual/checkout.spec.ts:21` リダイレクト画面が差分 19% で fail。ベースラインは
  `tests/e2e/visual/*-snapshots/*-chromium-darwin.png` の 3 枚。
- **Impact**: VRT が常時 red のため差分検出器として機能していない（真の視覚リグレッションが
  混入してもノイズと区別不能）。ページ高さ +351px は UI 変更（フッター/コンテンツ増）が
  ベースライン撮影後に入ったことを示す。
- **Effort**: S（UI 変更が意図的であることを目視確認の上 `--update-snapshots` で再撮影 →
  `tests/` 変更のためプラン化のみ）
- **Risk**: 再撮影時に「意図しない UI 破壊」を誤って固定するリスク → プランに目視確認手順を含める。
- **Confidence**: High

### [TESTS-29] E2E 実測の運用ガード欠如 — :3000 占有チェック無し / `globalTimeout` が実測 wall-clock に不足 / CI に E2E ジョブ無し

- **Evidence**: 実測 #1 の無効化経緯（前掲）。`run-local.sh:24-26` は :3000 停止を**コメントで
  注意喚起するのみ**で機械検証しない。`playwright.config.ts:10` の `globalTimeout: 1200s` は
  「概ね pass する」前提の値で、失敗リトライを含む実測 25.5m に対して不足（実測 #1 は
  これで打ち切られた）。`reuseExistingServer: !process.env.CI`（`playwright.config.ts:47`）は
  别サーバー（Docker dev コンテナ）を無警告で再利用する。
- **Impact**: 手順を知らない実行者（弱い executor を含む）が同じ罠を踏み、無効なベースラインを
  「実測値」として記録する事故が再発する。
- **Effort**: S（run-local.sh に lsof による :3000 事前チェック + `--global-timeout` 既定引き上げ。
  `scripts/` 変更のためプラン化のみ）
- **Risk**: 低
- **Confidence**: High（本ラウンドで実際に発生した事故の一次記録）

### [TESTS-30] payment-error「住所未選択エラー」skip は解消可能 — skip 理由が `createCustomerSession` 登場前の負債

- **Evidence**: `tests/e2e/payment-error.spec.ts:29` — skip 理由「Clerk認証セッションが必要」
  （2026-04-30 期限の TODO 付き）。同等の認証セットアップは `a11y/checkout.spec.ts:32-51` が
  `createCustomerSession()` + カート投入 + `/checkout` 到達まで既に実装済みで、再現手順
  （住所未選択で Place Order → "Select a shipping address"）はコメントに明記済み。
- **Impact**: チェックアウトの入力検証（異常系）が E2E 未固定。§20 P1「購入不能」系の
  ガード欠落。
- **Effort**: S（既存パターンの移植。**TESTS-26 修復が先行依存**）
- **Risk**: 低
- **Confidence**: High

### [TESTS-31] 注文詳細ページ（`/order/[orderId]`）の金額明細・支払い UI が E2E 未検証 — §20 P0「分割注文/請求」の請求側が未固定

- **Evidence**: `tests/e2e/platform-coupon.spec.ts:162` は注文詳細で
  `page.locator("p", { hasText: "Order Id:" })` の **2 件存在（OrderGroup 分割）まで**を検証。
  合計金額・配送料・クーポン割引額の表示値、支払いコンポーネントの描画は未検証。
  ページ実体は `src/app/(fullscreen)/order/[orderId]/`。
- **Impact**: §20 P0「複数店舗の商品を購入 → 正しく分割注文 / **請求** / 在庫更新」のうち
  請求表示の正しさが E2E で固定されていない。Integration（plan 027 系）は placeOrder の
  DB 値を固定するが、**顧客が見る金額表示**との一致は E2E でしか検証できない。
- **Effort**: M（既存 platform-coupon フローの延長で assert 追加。**TESTS-26 先行依存**）
- **Risk**: 中（金額表示のセレクタ契約が未整備なら data-testid 追加の要否判断が必要 —
  プランで STOP 条件として明示する）
- **Confidence**: High

### [TESTS-32] search-filter ページネーション skip — **/browse にページネーション UI 自体が未実装**（プラン執筆時の再監査で訂正）

- **Evidence**: `tests/e2e/search-filter.spec.ts:62-87` — `page.route("**/api/index-products*")`
  で 30 件をモックする設計だが SSR ページには効かず skip 放置。E2E seed は商品 2 種のみ
  （`tests/e2e/seed/constants.ts` — `e2e-test-product` / `e2e-test-product-b`）。
- **Evidence（訂正 2026-07-11・plan 046 執筆時）**: `src/app/(store)/browse/page.tsx:20-33` は
  searchParams から `page` を**読んでおらず**、`getProducts` を page 引数なし（既定 1 頁目・
  pageSize 10）で呼ぶ。共有 `Pagination` コンポーネント（`src/components/store/shared/
  pagination.tsx`）の利用箇所は profile history / product reviews / payments table のみで、
  **/browse には描画されない**。一方 `getProducts` は `page`/`pageSize` 引数と `totalPages`
  返却を実装済み（`src/queries/product.ts:601-605,870`）で、UI 配線だけが欠けている。
  つまり **/browse は商品が 11 件以上あっても先頭 10 件しか表示できない dormant な機能ギャップ**
  であり、skip テストは「存在しない UI」を待っていた。
- **Impact**: ページネーション UI（`page=2` 遷移・URL 正規化）が E2E 未固定 — ただし前提として
  機能実装（最小の searchParams 配線 + ページャ描画）が必要。
- **Effort**: M（当初見積の「seed 拡張のみ」から訂正: 最小 feature 配線（`src/` 変更）+
  専用カテゴリの seed 拡張 + skip 解除の 3 点セット。plan 046 が担当）
- **Risk**: 中（ページャ UI の追加が既存 browse レイアウト・他 spec に波及しないか要確認）
- **Confidence**: High（訂正後）

### [TESTS-33] ゲスト E2E 導線（track-order / compare / offers / 静的ページ）— TESTS-14 の昇格。認証不要で最も安定な未カバー領域

- **Evidence**: `src/app/(store)/` 配下に compare / offers / track-order / about / contact /
  faq(s) / legal / returns-exchange / customer-service / dispute / report-problem /
  product-support が実在。既存カバーは `layout-chrome.spec.ts` のヘッダー/フッター数検証のみで、
  機能導線（compare への商品追加 → 比較表示、track-order 検索、offers 一覧）は未カバー。
  compare は Zustand compare-store 依存でカート永続化と同型のテストパターンが流用可能。
- **Impact**: ゲスト導線は CLERK_SECRET_KEY 無しの CI でも動く安定価値があり、**TESTS-26 に
  依存しない唯一の拡張領域**（並行着手可能）。
- **Effort**: M（複数ページだが各テストは浅い）
- **Risk**: 低
- **Confidence**: High

### [TESTS-34] ウィッシュリスト E2E ゼロ — UI・server action・専用ページが揃っているのに導線未検証

- **Evidence**: `src/components/store/cards/product/product-card.tsx:124`（Heart ボタン）+
  `:31`（`addToWishlist` 呼び出し）+ `/profile/wishlist` ページ実在。E2E spec に wishlist への
  言及ゼロ。
- **Impact**: 顧客エンゲージメント導線（追加 → 一覧表示 → 解除）が未固定。
- **Effort**: M（**TESTS-26 先行依存**。product-card に wishlist 用 testid が無ければ追加要否の
  STOP 判断をプランに含める）
- **Risk**: 低
- **Confidence**: High

### [TESTS-35] ストアフォロー E2E ゼロ — followersCount の楽観更新 UI が未検証

- **Evidence**: `src/components/store/cards/store-card.tsx:24-30` — `followStore` +
  `followersCount` / `isUserFollowingStore` のローカル state 更新。`/profile/following` ページ
  実在。E2E ゼロ。
- **Impact**: フォロー toggle の往復（フォロー → カウント増 → 解除 → 減）と
  `/profile/following` への反映が未固定。
- **Effort**: M（**TESTS-26 先行依存**）
- **Risk**: 低
- **Confidence**: High

### [TESTS-36] レビュー投稿 E2E ゼロ — 星評価 UI に testid 契約が既にある

- **Evidence**: `src/components/store/forms/review-details.tsx:114` —
  `data-testid={"star-wrapper-${index}"}`（component テストで使用中の契約）。
  `upsertReview` の unit/integration はあるが、商品ページからの投稿 → 表示反映の E2E ゼロ。
- **Impact**: レビュー投稿はレビュー付き商品の削除 RESTRICT（plan 036）とも絡む主要導線だが
  ブラウザ検証ゼロ。
- **Effort**: M（**TESTS-26 先行依存**。画像アップロード（Cloudinary）はスキップし
  星 + テキストのみで検証する制約をプランに明記）
- **Risk**: 中（Cloudinary ウィジェットが review form でも使われる場合、操作対象から除外する
  設計が必要）
- **Confidence**: High

### [TESTS-37] プロフィール系 UI（注文履歴ページング・住所管理）E2E ゼロ

- **Evidence**: `src/app/(store)/profile/` 配下に addresses / history / orders / payment /
  reviews / settings / following / wishlist が実在。E2E は a11y profile（現在 TESTS-26 で fail）
  のみ。注文履歴は `history/[page]/page.tsx`（useEffect キャンセルフラグの実装例として
  tech.md にも登場する主要ページ）。
- **Impact**: 購入後の顧客体験（注文確認・住所 CRUD）が未固定。
- **Effort**: M〜L（**TESTS-26 先行依存**。注文履歴は事前に注文データを要するため
  placeOrder フロー成立後にのみ検証可能）
- **Risk**: 中
- **Confidence**: High

### [TESTS-38] 管理者「店舗ステータス変更 → ストアフロント反映」E2E ゼロ（§20 P1）— seller-onboarding 2 本目が唯一の隣接テストだが serial 連鎖で 1 度も実行されていない

- **Evidence**: `tests/e2e/seller-onboarding.spec.ts:143`「管理者が店舗を ACTIVE に変更＆販売者が
  ダッシュボードにアクセス」は本実測で **did not run**（serial 連鎖）。§20 P1「管理者が店舗停止 →
  全商品が非表示 / 購入不可」の**逆方向（BANNED/DISABLED 化）**はテスト自体が存在しない。
- **Evidence（リスク注記）**: admin の taxonomy CRUD フォーム（category / subCategory / product /
  store details）は `src/components/dashboard/shared/image-upload.tsx:8` の `CldUploadWidget`
  （next-cloudinary）に依存 → **OI-11 `self is not defined`（`QA_HANDOFF.md:125`）と同族の
  本番ビルド SSR リスク**があり、admin CRUD 系 E2E は OI-11 解消の影響圏。ステータス変更 UI
  （orders/stores テーブル操作）が Cloudinary 非依存であれば先行可能。
- **Impact**: 店舗 BAN の顧客側反映（商品非表示）は運営の主要オペレーションだが未固定。
- **Effort**: M〜L（**TESTS-26 先行依存** + ADMIN ロールセッション。`createCustomerSession()` は
  `role` 指定可能（`auth.ts` の `opts.role`）で流用できる）
- **Risk**: 中（admin 画面の Cloudinary 依存範囲の事前確認が必要）
- **Confidence**: Medium-High（ステータス変更 UI の Cloudinary 依存有無のみ未確認）

---

## Deferred（プラン化しない — 理由と再評価条件を記録）

| 項目 | 理由 / 再評価条件 |
|---|---|
| 販売者ダッシュボード CRUD E2E（商品・在庫・クーポン・配送） | **ユーザー決定済み deferred**。OI-11 `self is not defined`（本番ビルドで `/dashboard/seller` 系 SSR エラー — `QA_HANDOFF.md:125`）の解消が先行依存。解消後に R9 以降で再評価 |
| 決済失敗ロールバック E2E（§20 P0） | Stripe テストモードの失敗カード（4000 0000 0000 0002 等）+ 実キーが必要で effort L。checkout の決済コンポーネントが実 Stripe Elements を描画する前提も要検証。**Integration 側（plan 032 の webhook 系）が DB 巻き戻しを部分カバー**しており、E2E 化は決済 UI 検証の付加価値が確定してから |
| payment-error `:58` 在庫切れ表示 skip | カートページに Out of stock 表示機能自体が未実装（spec 内 TODO に実装場所 `src/components/store/cart-page/` まで記録済み）。機能実装時に spec を書き直す |
| payment-error `:70` 二重送信冪等性 skip | 冪等性トークン未実装（plan 006 が先行依存） |
| mobile-responsive skip 2 件（ハンバーガーメニュー / 375px カート） | いずれも**機能未実装**が skip 理由としてテスト名に明記済み。UI 実装が先 |

## Rejected（起票しない）

| 候補 | 理由 |
|---|---|
| ページネーションを route-mock 方式で復活 | 現 skip 実装（`search-filter.spec.ts:63-70`）がまさに route-mock で、SSR ページに効かず壊れた実績。実サーバー検証にならないため seed 拡張方式（TESTS-32）を採用 |
| 3 ブラウザフル E2E の CI 常設 | wall-clock 25.5m+（失敗時はさらに増）と Clerk 実キーの secrets 運用が前提。まず TESTS-26 修復でローカル green を回復し、CI 化は chromium 限定 + nightly 等の設計を別途検討（TESTS-29 のガード整備が先） |
| a11y `color-contrast` ルールの有効化 | 既知デザイン負債として QA_HANDOFF「a11y color-contrast 負債」で追跡中（`a11y/checkout.spec.ts:78-80` の disabledRules コメントが参照）。本ラウンドの網羅性スコープ外 |

## 依存関係と着手順（Step 3 提示用）

```
TESTS-26 (signIn 修復)  ──先行──►  TESTS-30/31/34/35/36/37/38（認証系すべて）
TESTS-27 (svg-img-alt)  ──先行──►  a11y checkout/profile の green 化（TESTS-26 と直列）
TESTS-28 (VRT 再撮影)   独立
TESTS-29 (運用ガード)   独立
TESTS-32 (ページネーション + seed) 独立（認証不要）
TESTS-33 (ゲスト導線)   独立（認証不要・CI 安定価値最大）
```

**leverage 最大は TESTS-26**（単独で 16 テスト instance を回復し、認証系の全新規プランの
前提を解除する）。次点は TESTS-27（26 と直列で a11y 2 spec を回復）・TESTS-33（依存ゼロで
即着手可能）。
