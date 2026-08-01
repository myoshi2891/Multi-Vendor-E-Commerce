# Findings 17 — E2E 残余監査（Round 9 / vetted）

> **Round 9**（2026-07-12 / 監査対象 HEAD `25e50d9` / branch `dev` — R8 クローズコミット。
> R8 監査 HEAD `fbd1020` からソース `src/ tests/ prisma/` は無変更 — R8 クローズ時に diff 空を
> 検証済み）。`tests` フォーカス・**E2E（Playwright）限定**の第 2 弾（R6/R7 の integration
> 残余監査と同型）。
> **方法**: R8 の findings-16 が「既存 15 spec の 3 ブラウザ実測 + 主要導線ギャップ」を
> スイープ済みのため、本ラウンドは **R8 未スイープの新規切り口 8 系統**を直接コード読解で vet。
> 補助として稼働中 Docker アプリへの読み取り系スポット検証（`curl` による HTTP status 確認）
> のみ実施。**全所見を本体が直接コードを開いて vet 済み**（サブエージェント不使用）。

## ベースライン（再実測なし — R8 実測 #2 を SSOT として引き継ぎ）

ソースが R8 実測時から無変更のため、3 ブラウザ再実測は行わない（同一結果の再導出に
25.5m を費やすだけであるため）。ベースラインは **findings-16 の実測 #2** を引き続き SSOT とする:

| 指標 | 値（findings-16 実測 #2 / 2026-07-11） |
|---|---|
| 結果 | 52 passed / 17 failed / 39 skipped / 3 did not run（111 total / exit 1） |
| 失敗の根本原因 | TESTS-26（signIn ドリフト・13 件）/ TESTS-27（svg-img-alt・1 件）/ TESTS-28（VRT 陳腐化・3 件） |
| 実効カバレッジ | **ゲスト導線のみ green**。認証系 E2E は全滅（plans 042〜050 で修復・拡張予定、未実行） |

## スコープ定義

- **対象**: R8 未スイープの新規切り口（下記 8 系統）。既存 15 spec の実測・主要導線ギャップは
  findings-16 で監査済みのため再スイープしない。
- **重複回避**: plans 042〜050 の in-scope（signIn 修復 + svg aria-label / VRT 再撮影 /
  run-local ガード / ゲスト track-order・compare・offers・静的ページ / browse ページャ /
  payment-error :29 un-skip + 注文詳細金額 / wishlist・follow・review / profile 注文履歴・住所 /
  admin 店舗ステータス）と対象 UI・シナリオが重複するプランは作らない。各所見に非重複の根拠を記載。
- **スイープした 8 系統**: (1) サインアップ導線 / (2) Newsletter 購読 / (3) 国選択セレクタ /
  (4) ゲストカート→ログイン時マージ / (5) a11y 対象拡大 / (6) VRT 対象拡大 /
  (7) 404・サインアウト等の残余 / (8) R8 deferred 再裁定

---

## 新規所見（Round 9・すべて直接 vet 済み）

### [TESTS-39] Newsletter 購読が dormant 404 — フッターのフォームは `/api/newsletter` へ POST するが route がリポジトリに存在せず、成功系が構造的に到達不能

- **Evidence**: `src/components/store/layout/footer/newsletter.tsx:41-46` —
  `fetch('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }) })`。
  `src/app/api/` 配下は `index-products` / `search-products` / `setUserCountryInCookies` /
  `webhooks` の 4 route のみで **newsletter route は不在**。`src/queries/` にも newsletter 系
  server action なし（`grep -ril newsletter src` は footer コンポーネント 2 件のみ）。
- **Evidence（スポット実測 2026-07-12）**: 稼働中 Docker アプリへ
  `curl -X POST http://localhost:3000/api/newsletter` → **404**。
  `newsletter.tsx:48` の `if (!response.ok) throw` により**全購読操作が
  「Failed to subscribe.」トースト（`:56`）に終わる**。
- **Evidence（永続層も不在）**: `prisma/schema.prisma` に newsletter / subscriber 系モデルなし
  （`grep -i "newsletter\|subscri" prisma/schema.prisma` = 0 件）。つまり E2E の成功系を書くには
  route 追加 + スキーマ migration + 保存先の設計（= 機能実装）が先行する。TESTS-32
  （/browse ページャ未実装）と同型の **dormant な機能ギャップ**だが、TESTS-32 と違い
  既存クエリ関数の「UI 配線だけ欠落」ではなく**バックエンド一式が不在**のため、
  E2E プラン内の最小配線で解消できる規模を超える。
- **Impact**: フッターは全ストアフロントページに露出し「$10 coupon for first shopping」を
  提示するが（`newsletter.tsx:22`）、購読は 100% 失敗する。E2E 観点では
  (a) 現挙動（失敗トースト + リエントランシーガード）の characterization を固定するか、
  (b) 機能実装後に成功系 E2E を書くか、の二択。
- **Effort**: characterization のみなら S / 成功系はアプリ実装（route + migration + 保存先）が
  先行するため E2E 単体では見積不能
- **Risk**: characterization は「壊れた挙動の固定」であり、機能実装時にテスト書き直しが確定する
- **Confidence**: High（route 不在 + curl 404 実測 + スキーマ不在の三点で確認）

### [TESTS-40] 国選択セレクタ（Ship to）E2E ゼロ — cookie 書き込み → SSR 再描画の往復が未検証。ゲスト到達可能で依存ゼロの最有力候補

- **Evidence**: `src/components/store/layout/header/country-lang-curr-selector.tsx:30-58` —
  国選択時に `fetch("/api/setUserCountryInCookies", { method: "POST" })` → `response.ok` で
  `router.refresh()`。ドロップダウンは CSS `group-hover` で開く（`:60,84`）。
  route 実体は `src/app/api/setUserCountryInCookies/route.ts:14-20`（`userCountry` cookie を
  `httpOnly` / `sameSite: lax` で設定）。
- **Evidence（未カバー確認）**: `tests/e2e/` 全 spec に国選択 UI の操作なし（platform-coupon /
  stock-decrement の `country` 参照は Prisma seed 直挿入のみ）。unit は
  `route.test.ts`（API 単体）と `parseUserCountryCookie`（`src/lib/utils.ts` — plan 024 が
  サーバー側検証を扱う）のみで、**「ヘッダー hover → 国選択 → cookie → refresh → ヘッダー表示
  更新」のブラウザ往復はどの層でも未検証**。
- **Impact**: userCountry cookie は配送先表示・配送料計算（`getShippingDetails` 系）の入力で
  あり、壊れると顧客が配送先を変更できない。tech.md が cookie パースを規約化
  （`parseUserCountryCookie` 必須）するほど中核の状態だが、E2E の実効カバレッジは
  ゲスト導線が中心（findings-16）にもかかわらずこの**ゲスト到達可能・認証不要**の導線が
  抜けている。
- **Effort**: S〜M（hover での開閉 + `CountrySelector` 操作 + ヘッダー表示の変化 assert +
  リロード後の cookie 永続確認。商品/カートページの配送料表示変化まで含めると M）
- **Risk**: 低（既存機能の検証のみ。hover ベース UI は Playwright `hover()` で操作可能）
- **Confidence**: High

### [TESTS-41] 認証サーフェスのスモーク E2E ゼロ — サインアップウィジェット描画とサインアウト導線が未検証（TESTS-26 と同型のウィジェットドリフトを検出する層が無い）

- **Evidence**: `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — Clerk `<SignUp />` を描画。
  既存カバーは `layout-chrome.spec.ts:47-48` の「ヘッダー/フッターが各 1 つ」のみで、
  **Clerk ウィジェット自体の描画（フォームフィールドの可視性）はどの spec も assert しない**。
  サインアウトは `src/components/store/layout/header/user-menu/user-menu.tsx:104` の
  `<SignOutButton />` で、E2E 全 spec に操作なし（認証系 spec は個別に `signIn` するのみ）。
- **Evidence（教訓の根拠）**: TESTS-26（findings-16）は Clerk サインイン UI のドリフトが
  **16 テスト全滅として初めて顕在化**した事例。サインアップ側には同型のドリフトを
  早期検出する canary が存在しない（auth.ts はユーザー作成を Clerk **API 直**で行うため、
  サインアップ UI は E2E インフラからも一切通らない）。
- **Impact**: 新規顧客獲得の入口（Register 導線 → サインアップ）と退出（サインアウト →
  ゲスト状態復帰）が未固定。ウィジェット描画スモークは Clerk メジャーアップグレード
  時の回帰検出器にもなる（**plan 004 は DONE** — 当時想定した `^7.0.7 → ^7.5.0` の
  バンプは実施済みで、本スモークの価値は**次回以降の**アップグレードに対して残る）。
- **Effort**: S（サインアップページのウィジェット描画スモークはゲスト到達可能・依存ゼロ。
  サインアウト往復は **TESTS-26 修復 = plan 042 先行依存**）
- **Risk**: 低（フル サインアップ（メール確認コード入力）まで踏み込むと Clerk test mode の
  `+clerk_test` / 424242 固定コード前提が増えるため、スモークはフィールド可視性までに留める
  設計が妥当）
- **Confidence**: High

### [TESTS-42] ゲストカート → サインイン後のカート引き継ぎ（saveUserCart 往復）E2E ゼロ — 「未認証エラー」までは既存カバーがあるが、認証後の同一カート持ち越しは未検証

- **Evidence**: `src/components/store/cart-page/summary.tsx:25-36` — Checkout ボタンが
  `saveUserCart(cartItems)` を呼び、成功時のみ `router.push("/checkout")`。
  `purchase-flow.spec.ts` は「未認証ユーザーがチェックアウトに進むと認証エラーが表示される」
  までを固定済み（エラートースト分岐 `:32`）。**ゲストで構築したカート（Zustand persist）を
  サインイン後にそのまま Checkout → DB 保存 → /checkout に同一アイテムが出る**、という
  認証遷移をまたぐ整合はどの spec も検証しない。
- **Evidence（既存プランとの非重複）**: plan 047 は payment-error `:29` の un-skip
  （認証済みセッションを**最初から**作る）と platform-coupon への金額 assert 追記のみが
  in-scope。a11y/checkout.spec.ts のセットアップも `createCustomerSession()` で最初から
  認証済み。**「ゲスト状態でカートを作ってから認証する」順序**を踏むテストは存在しない。
- **Impact**: カート持ち越しは購入コンバージョンの主要経路（ゲストで商品を貯めてから
  会員化する導線）。~~`saveUserCart` の integration テストは plan 005（カート整合性の
  correctness 修正）先行で deferred 継続中（R5〜R7 台帳）のため~~、この経路は現状
  **どの層でも自動検証されていない**。
  （**取り消し線部は 2026-07-19 に失効した旧前提** — plan 005 は DONE。「未検証」という結論は
  変わらないが、その理由は「先行プラン待ち」ではない。正しい現状は直下の追記を参照。）
  > **⚠️ 2026-07-19 追記 — 上記の deferred 理由は失効している**。先行依存としていた
  > **plan 005 は DONE**（[`../README.md`](../README.md) の Status 表が SSOT）。
  > よって `saveUserCart` の integration テストは**待ち状態ではなく昇格の再評価対象**で、
  > 「どの層でも自動検証されていない」という現状認識自体は変わらないものの、
  > **その理由は「先行プラン待ち」ではなく「まだ起票していない」**に変わっている。
  > R5〜R7 台帳（[`findings-13`](findings-13-integration-coverage.md) /
  > [`findings-14`](findings-14-integration-coverage-r6.md)）の対応行にも同じ注記あり。
- **Effort**: M（**TESTS-26 修復 = plan 042 先行依存**。purchase-flow の既存カート構築
  ヘルパー + `signIn` の合成で書ける）
- **Risk**: 中 → **低に下方修正**（訂正 2026-07-19）。当時のリスク源は「plan 005 の
  correctness 修正が**これから**入るとカート保存の挙動が変わり得る」ことだったが、
  **005 は既に DONE** で変更は着地済み。粗い assert に留める設計指針
  （「アイテムが /checkout に現れる」レベル）はそのまま有効）
- **Confidence**: High

### [TESTS-43] a11y スキャン対象がストアフロント主要 4 ページ（home / browse / 商品詳細 / cart）に未拡大 — 全てゲスト到達可能で認証修復に依存しない

- **Evidence**: `tests/e2e/a11y/` は sign-in / checkout / profile / seller-apply の 4 spec のみ。
  顧客が最も長く滞在する home（`/`）・browse（`/browse`）・商品詳細
  （`/product/[productSlug]/[variantSlug]`）・cart（`/cart`）は axe スキャン対象外。
  スキャンヘルパー `runA11yScan`（`tests/e2e/a11y/_helpers.ts` — WCAG 2.1 AA タグ・
  readiness locator・disabledRules 引数）はそのまま流用できる。
- **Evidence（先行依存 2 件）**:
  (1) 4 ページ全てフッターを持つため、**TESTS-27 の `svg-img-alt` 違反（serious）が修正される
  まで全スキャンが同一違反で fail する** — 修正は plan 042 Step 4（`send.tsx` 等への
  `aria-label` 追加）が担当済み。
  (2) **home は OI-9 により本番ビルド SSR で 500**（`featured.tsx:13` の `window` 初期化子 —
  `QA_HANDOFF.md:124` で未着手を確認）。E2E は `next build` + `next start` で走るため、
  **home のスキャンは OI-9 解消が先行依存**。browse / 商品詳細 / cart は影響なし。
- **Impact**: a11y ヒートマップの空白が「認証必須ページ」ではなく「最多トラフィックの
  ゲストページ」側に残っている。color-contrast 以外の serious 違反（TESTS-27 で 1 件実証済み）
  が主要ページに潜在していても検出経路が無い。
- **Effort**: S〜M（browse / 商品詳細 / cart の 3 spec は既存パターンの複製で書ける。
  home は OI-9 待ちで scope 分割）
- **Risk**: 低〜中（初回スキャンで未知の違反が出た場合の裁定手順 — 修正 or disabledRules +
  負債記録 — をプランに含める必要がある。`_helpers.ts` の docstring が既にその規約を規定済み）
- **Confidence**: High

### [TESTS-44] VRT 対象が cart / checkout リダイレクトの 3 枚のみ — 商品詳細・browse のレイアウト回帰が視覚検証されていない

- **Evidence**: `tests/e2e/visual/` は cart.spec.ts（`cart-empty.png` / `cart-with-item.png`）+
  checkout.spec.ts（`checkout-redirect-signin.png`）の 3 スナップショットが全て。
  共通フィクスチャ `_fixtures.ts`（決定論的 seed + `setupE2ETestState`）は流用可能。
  商品詳細（価格・バリアント選択・カート追加ボタンの配置）と browse（商品グリッド）は
  スナップショットゼロ。
- **Evidence（先行依存）**: 既存 3 枚は TESTS-28 で**陳腐化により常時 red**（findings-16）。
  ベースライン再撮影と再発防止の運用規律は plan 043 が担当するため、**対象拡大は plan 043 の
  完了後**でないと「最初から red なスイートに枚数を足す」ことになる。home は OI-9
  （SSR 500）解消が先行依存（TESTS-43 と同一理由）。
- **Impact**: 購買判断が起きる 2 ページ（商品詳細・browse）の視覚回帰が検出不能。
  Tailwind クラス順序 lint はあるがレイアウト崩れ自体を検出する層は VRT のみ。
- **Effort**: M → **S〜M に下方修正**（訂正 2026-07-12・plan 054 執筆時の再監査:
  E2E seed の商品画像は Cloudinary リモートではなく**ローカルアセット**
  `/assets/images/no_image.png`（`tests/e2e/seed/constants.ts:68,76,96` 等）— E2E DB には
  seed:e2e の 2 商品しか無いため browse / 商品詳細の描画は決定論的。リモート画像フレークの
  懸念は当初見積より小さい。マスクは既存 cart.spec.ts の前例に合わせ画像領域のみでよい）
- **Risk**: 低〜中（動的コンテンツ起因のフレークは config の reducedMotion / locale /
  timezone 固定で大半が抑制済み。plan 043 の再撮影ガイドラインと運用を揃えること）
- **Confidence**: High

---

## Deferred（プラン化しない — 理由と再評価条件を記録）

| 項目 | 理由 / 再評価条件 |
|---|---|
| **R8 deferred 5 件の再裁定** — 販売者ダッシュボード CRUD（OI-11 依存）/ 決済失敗ロールバック / payment-error `:58` 在庫切れ表示 / `:70` 二重送信（plan 006 依存）/ mobile-responsive skip 2 件（機能未実装） | **全件維持**。ソース（`src/ tests/ prisma/`）が R8 監査時から無変更のため、先行条件（OI-11 未解消・plan 006 未実行・機能未実装）はいずれも変化していない（`QA_HANDOFF.md:124-125` で OI-9/OI-11 とも「未着手」を確認）。次の再評価は plans 042〜050 実行後 or OI-11 解消後 |
| TESTS-39 の成功系 E2E（Newsletter 購読） | **機能実装が先行**（route + スキーマ migration + 保存先設計が丸ごと不在）。E2E プラン内の最小配線（plan 046 方式）で吸収できる規模を超える。characterization（失敗トースト固定）は選択肢としてユーザー提示する |
| home（`/`）の a11y / VRT | **OI-9（featured.tsx SSR 500）解消が先行依存**。browse / 商品詳細 / cart と scope 分割し、OI-9 解消後に追加する（TESTS-43 / TESTS-44 の各プランに追記条件として記録） |

## Rejected（起票しない）

| 候補 | 理由 |
|---|---|
| カスタム 404 ページの E2E | `src/app/` に `not-found.tsx` / `error.tsx` が存在せず（find で 0 件）、検証対象は Next.js デフォルト 404 のみ。フレームワーク挙動の検証は価値が薄く、カスタム 404 の実装（direction 候補）が先 |
| フル サインアップ E2E（確認コード入力 → セッション成立まで） | Clerk test mode 固定コード（424242）前提のフロー全長テストは、auth.ts が API 直でユーザー作成する現行設計と重複投資。ウィジェット描画スモーク（TESTS-41）で UI ドリフト検出という目的は達成でき、フロー全長は Clerk 自身のテスト責務に近い |
| 言語 / 通貨セレクタの E2E | `country-lang-curr-selector.tsx:106-128` の Language / Currency 欄は**静的表示のみ**（onChange ハンドラ無し・"English" / "USD" ハードコード）。操作可能な機能が存在しないため検証対象なし（多通貨は product.md でスコープ外宣言済み） |

## 依存関係と着手順（Step 3 提示用）

```
TESTS-40 (国選択)          独立（ゲスト・依存ゼロ — leverage 最大）
TESTS-41 (認証スモーク)     sign-up スモークは独立 / サインアウトのみ plan 042 先行
TESTS-43 (a11y 拡大)       plan 042 Step 4（svg-img-alt 修正）先行。home のみ OI-9 待ち
TESTS-42 (カート引き継ぎ)   plan 042 先行
TESTS-44 (VRT 拡大)        plan 043 先行。home のみ OI-9 待ち
TESTS-39 (Newsletter)      機能実装先行（characterization のみ即着手可）
```

**leverage 最大は TESTS-40**（依存ゼロ・ゲスト安定・cookie という中核状態の往復検証）。
次点は TESTS-43（3 ページ分を既存ヘルパー複製で拡大でき、042 実行後すぐ着手可能）。
TESTS-39 は「E2E 追加」より「dormant 機能の correctness 起票」としての価値が主で、
プラン化するなら characterization + 将来の書き直し前提を明記する。
