# 包括的テスト実装計画書 (Comprehensive Test Implementation Plan)

## 1. 目的とスコープ
本計画書は、Multi-Vendor EC プロジェクトにおいて現在不足しているテストケースを特定し、世界トップクラスの品質基準を満たすための実装ロードマップを定義するものである。

### 品質基準
- **Decimal 精度**: 金額計算（`.add()`, `.mul()` 等）の浮動小数点誤差ゼロを保証する。
- **トランザクション整合性**: `db.$transaction` によるアトミックなデータ整合性を検証する。
- **構造化ログ**: `[Module:Function]` 形式のエラーログ出力を検証する。
- **セキュリティ**: IDOR 防止、ロールベースのアクセス制御 (RBAC) の徹底。
- **TDD 実践**: 実装前に失敗するテスト (Red) を記述し、仕様と実装の乖離を防ぐ。

---

## 2. 現状のテスト欠落領域 (Identified Gaps)
以下の領域は現在テストが不足、または完全に欠落しており、本計画における最優先の修正対象となる。

### 1. UI コンポーネント (`src/components/`)
プロジェクト内で最もテストが不足している領域。以下のコンポーネントに対するユニットテスト（Jest + React Testing Library）を順次実装する。
- **店舗/顧客向けUI (`src/components/store/`)**: 商品カード、チェックアウトフォーム、検索バー、レビュー表示など。
- **ダッシュボード/管理者・販売者向けUI (`src/components/dashboard/`)**: データテーブル、商品登録フォーム、ステータス変更UIなど。
- **共通コンポーネント (`src/components/ui/`, `src/components/shared/`)**: ボタン、モーダル、入力フォーム等の再利用可能なUI部品。

### 2. Next.js ページとレイアウト (`src/app/`)
画面のレンダリングを担うページコンポーネントに対するテストの実装。
- **`app/(store)/*`**: トップページ、商品詳細、カート、プロファイル画面など。
- **`app/dashboard/*`**: 販売者・管理者ダッシュボード画面。
- **`app/(auth)/*`**: サインイン・サインアップ画面。

### 3. カスタムフック (`src/hooks/`)
UI/状態管理に関わるカスタムフックの振る舞い検証。
- `use-mobile.tsx`, `use-toast.ts`, `useFromStore.ts`

### 4. ミドルウェアと重要ユーティリティ・プロバイダー
- **ミドルウェア**: `src/middleware.ts`（認証ルート保護、リダイレクトロジック）。
- **ユーティリティ**: `src/utils/sanitize.ts`（サニタイズ）、`src/lib/elastic-search.ts`、`src/lib/country.ts` など。
- **Context Provider**: `src/providers/modal-provider.tsx`。

### 5. E2E テストのシナリオ (`tests/e2e/`)
現状カートのスモークテストのみのため、以下の主要ジャーニーを拡充する。
- **認証フロー**: ユーザーのサインアップ・サインイン。
- **購入フロー**: 商品検索 → カート追加 → 決済完了 (Stripe/PayPal)。
- **販売者フロー**: 新規店舗作成 → 商品出品。

---

## 3. フェーズ別実装ロードマップ

### Phase 1: 基盤ロジック・ユーティリティ (Unit Tests) 【優先度: P0】
システムの信頼性の根幹となるロジックを固める。

| 対象項目 | ファイルパス | 検証のポイント |
|:---|:---|:---|
| **Middleware** | `src/middleware.ts` | 未認証時のリダイレクト、Seller/Admin ロール別のアクセス制限。 |
| **Custom Hooks** | `src/hooks/*.tsx` | `use-mobile` のレスポンシブ検知、`useFromStore` のハイドレーション。 |
| **Utilities** | `src/utils/sanitize.ts` | XSS 対策（スクリプト除去・エスケープ）の境界値テスト。 |
| **Providers** | `src/providers/*.tsx` | `modal-provider` の動的コンポーネント管理と状態遷移。 |

### Phase 2: UI コンポーネント (Component Tests) 【優先度: P1】
ユーザーインターフェースの振る舞いと Zod バリデーションを検証する。

#### A. Store (顧客向け)
- **商品詳細ページ**: バリアント選択時の価格（Decimal 表示）と在庫状況の即時反映。
- **カート・チェックアウト**: 数量変更時の動的小計計算、配送料の国別計算ロジック。
- **クーポン適用フォーム**: 有効/無効/期限切れクーポンのバリデーションとエラー表示。

#### B. Dashboard (管理・販売者向け)
- **データテーブル (`DataTable`)**: フィルタリング、ソーティング、多件数時のページネーション。
- **登録フォーム**: `ProductDetails`, `StoreDetails` での必須項目・形式チェック（Zod）。
- **ステータス切替**: `OrderStatusSelect` 等の変更に伴う API 通信とトースト通知。

### Phase 3: 重要ワークフロー (E2E Tests) 【優先度: P1-P2】
Playwright を使用し、実際のユーザージャーニーをエンドツーエンドで検証する。

| シナリオ | 内容 | ツール |
|:---|:---|:---|
| **購入フルフロー** | 検索 → カート → Stripe/PayPal 決済 → 注文完了 → DB 整合性。 | Playwright |
| **Seller オンボーディング** | 申請 → Admin 承認 → 店舗作成 → 商品出品。 | Playwright |
| **決済異常系** | 決済キャンセル、カード拒否、二重決済試行時の冪等性検証。 | Playwright |

---

## 3. 重点検証戦略 (Specialist Focus)

### 1. 精度と整合性
- **Decimal 演算テスト**: 極端に小さい値（0.01）や大きい値での計算結果を `Prisma.Decimal` メソッドで厳密に比較する。
- **ロールバック検証**: トランザクション内で意図的にエラーを発生させ、全操作がロールバックされることを確認する。

### 2. セキュリティと権限
- **IDOR テスト**: `currentUser` の ID を書き換えて他者のリソースにアクセスを試み、403/404 になることを確認する。
- **Webhook 検証**: Svix の署名検証が正しく機能し、偽装された Webhook を拒否することをテストする。

---

## 4. 実行ガイドライン (TDD サイクル)

1. **Red Phase**: `ec-qa-expert` スキルを使い、仕様に基づいた「失敗するテスト」を作成する。
2. **Green Phase**: テストをパスさせるための最小限の実装を行う。
3. **Refactor Phase**: `Antigravity` のコーディング規約（`tech.md`）に従い、コードを洗練させる。
4. **Validation**: `test-complete` スキルを実行し、リント・型チェック・全テストのパスを確認する。

---

## 5. テスト統計の目標
- **Unit/Integration**: 現状 686 テスト → **1,000+** テストへの拡充。
- **E2E**: 主要シナリオ **10+** ケースの網羅。
- **Coverage**: ビジネスロジックの **C1 (条件網羅) 100%**。

---

## Phase 1: 基盤ロジック・ユーティリティ (P0) — 想定 ~112 テスト

### 1-1. `src/middleware.ts` → `src/middleware.test.ts`

| 環境 | 種別 | 想定テスト数 |
| --- | --- | --- |
| node | Unit | 18 |

**モック対象:** `@clerk/nextjs/server` (clerkMiddleware, createRouteMatcher), `next/server` (NextResponse), `@/lib/country` (getUserCountry)

`describe("middleware")
  describe("保護ルート判定")
    正常系: /dashboard への未認証アクセスで auth().protect() が呼ばれる          [P0]
    正常系: /dashboard/seller/stores/xxx で protect が呼ばれる                   [P0]
    正常系: /checkout で protect が呼ばれる                                      [P0]
    正常系: /profile で protect が呼ばれる                                       [P0]
    正常系: /profile/orders/pending で protect が呼ばれる                        [P0]
    正常系: / (トップページ) は protect が呼ばれない                              [P0]
    正常系: /product/xxx は保護対象外                                            [P1]
    正常系: /api/webhooks は保護対象外                                           [P1]

  describe("国検出 Cookie 処理")
    正常系: userCountry Cookie 存在時は getUserCountry が呼ばれない              [P1]
    正常系: userCountry Cookie 存在時は NextResponse.next() を返す               [P1]
    正常系: Cookie 不在時に getUserCountry が呼ばれる                            [P1]
    正常系: Cookie 不在時にリダイレクトレスポンスが返される                       [P1]
    正常系: userCountry Cookie が httpOnly/sameSite=lax で設定される             [P1]
    正常系: production 環境で secure=true が設定される                           [P2]
    正常系: development 環境で secure=false が設定される                         [P2]
    異常系: getUserCountry が例外を投げてもミドルウェアがクラッシュしない         [P0]

  describe("matcher 設定")
    正常系: config.matcher が想定パターン配列を含む                              [P2]
    正常系: 静的ファイルと _next がマッチしない                                  [P2]`

**テストインフラ活用:** `AuthTestHelpers` を参考に auth() モック構築, `TEST_CONFIG.DEFAULT_USER_ID`

---

### 1-2. `src/lib/country.ts` → `src/lib/country.test.ts`

| 環境 | 種別 | 想定テスト数 |
| --- | --- | --- |
| node | Unit | 15 |

**モック対象:** グローバル `fetch`, `setTimeout`/`clearTimeout`, `AbortController`

`describe("getUserCountry")
  describe("正常系")
    正常系: ipinfo.io 正常レスポンスで国名・コード・都市・地域を返す              [P1]
    正常系: 国コード "JP" で countries.json から "Japan" を逆引きする             [P1]
    正常系: countries.json にない国コードはコードをそのまま name に使用            [P1]
    正常系: city/region が null の場合、空文字にフォールバック                    [P2]

  describe("異常系")
    異常系: fetch が非200レスポンスの場合、デフォルト国 (US) を返す               [P0]
    異常系: fetch がネットワークエラーの場合、デフォルト国を返す                  [P0]
    異常系: country フィールドなしの場合、US の name/code + レスポンスの city/region [P1]
    異常系: AbortController タイムアウト (2秒超過) でデフォルト国を返す           [P0]
    異常系: JSON パースエラーの場合、デフォルト国を返す                           [P1]

  describe("エッジケース")
    エッジケース: IPINFO_TOKEN が undefined でも fetch は呼ばれる                [P2]
    エッジケース: country が空文字の場合の挙動                                   [P2]

  describe("副作用")
    正常系: エラー時に console.error が呼ばれる                                  [P2]
    正常系: clearTimeout が finally で必ず呼ばれる                               [P2]
    正常系: タイムアウト時に AbortController.abort() が発火する                  [P2]`

**テストインフラ活用:** `AssertionHelpers.mockConsoleError()`

---

### 1-3. `src/utils/sanitize.ts` → `src/utils/sanitize.test.ts`

| 環境 | 種別 | 想定テスト数 |
| --- | --- | --- |
| node | Unit | 14 |

**依存:** DOMPurify + jsdom (sanitize.ts 自体が jsdom を内部生成するため node 環境で実行可能)

`describe("sanitize")
  describe("正常系")
    正常系: プレーンテキストをそのまま返す                                       [P1]
    正常系: 安全な HTML タグ (&lt;p&gt;, &lt;b&gt;, &lt;em&gt;) を保持する                         [P1]
    正常系: 空文字を入力すると空文字を返す                                       [P2]

  describe("XSS 防御")
    異常系: `<script>alert('xss')</script>` を除去する                            [P0]
    異常系: `<img onerror="alert(1)">` の onerror を除去する                      [P0]
    異常系: `<a href="javascript:alert(1)">` の javascript: URI を除去する        [P0]
    異常系: `<svg onload="alert(1)">` の onload を除去する                        [P0]
    異常系: `<iframe src="evil.com">` を除去する                                  [P0]
    異常系: onclick/onmouseover 等のイベントハンドラを除去する                   [P0]
    異常系: HTML エンティティエンコードされた XSS を処理する                     [P0]

  describe("エッジケース")
    エッジケース: ネストされた悪意タグの除去                                     [P1]
    エッジケース: 1000文字超の長文字列でクラッシュしない                         [P2]
    エッジケース: 日本語テキストを含む HTML を正しく処理する                     [P2]
    エッジケース: data-* カスタム属性の取り扱い                                 [P2]`

**テストインフラ活用:** `TEST_CONFIG.EDGE_CASES` (VERY_LONG_STRING, UNICODE_STRING)

---

### 1-4. カスタムフック (3 ファイル)

### 1-4a. `src/hooks/use-mobile.tsx` → `src/hooks/use-mobile.test.tsx`

| 環境 | 種別 | 想定テスト数 |
| --- | --- | --- |
| jsdom (`/** @jest-environment jsdom */`) | Unit | 8 |

**テスト手法:** `@testing-library/react` の `renderHook` + `window.matchMedia` モック

`describe("useIsMobile")
  正常系: 初期状態で false を返す (!!undefined)                                  [P2]
  正常系: innerWidth < 768 → true                                               [P1]
  正常系: innerWidth >= 768 → false                                             [P1]
  境界値: innerWidth === 767 → true                                             [P1]
  境界値: innerWidth === 768 → false                                            [P1]
  正常系: matchMedia change イベントで値が更新される                             [P1]
  正常系: アンマウント時にイベントリスナーが除去される                           [P2]
  エッジケース: matchMedia 未対応環境でクラッシュしない                          [P2]`

### 1-4b. `src/hooks/use-toast.ts` → `src/hooks/use-toast.test.ts`

| 環境 | 種別 | 想定テスト数 |
| --- | --- | --- |
| node | Unit (reducer は純粋関数) | 14 |

**テスト対象:** `reducer` (export 済み), `genId` (内部関数だが reducer テスト経由で検証)

`describe("toast reducer")
  describe("ADD_TOAST")
    正常系: トーストが追加される                                                 [P1]
    正常系: TOAST_LIMIT (1) を超えると最新のみ保持される                         [P1]
    正常系: id が付与される                                                      [P2]

  describe("UPDATE_TOAST")
    正常系: 指定 id のトーストが更新される                                       [P1]
    正常系: 存在しない id では state が変わらない                                [P2]

  describe("DISMISS_TOAST")
    正常系: 指定 id の open が false になる                                      [P1]
    正常系: toastId=undefined で全トーストが dismiss                             [P1]
    エッジケース: 空 toasts 配列で DISMISS しても例外なし                        [P2]

  describe("REMOVE_TOAST")
    正常系: 指定 id のトーストが除去される                                       [P1]
    正常系: toastId=undefined で全トーストが除去される                           [P1]
    エッジケース: 存在しない id で状態が変わらない                               [P2]

  describe("genId — reducer 経由で検証")
    正常系: 連続 ADD_TOAST で一意の id が生成される                              [P2]
    エッジケース: MAX_SAFE_INTEGER 超過でリセットされる                          [P2]
    正常系: id は文字列型                                                        [P2]`

### 1-4c. `src/hooks/useFromStore.ts` → `src/hooks/useFromStore.test.tsx`

| 環境 | 種別 | 想定テスト数 |
| --- | --- | --- |
| jsdom (`/** @jest-environment jsdom */`) | Unit | 6 |

**テスト手法:** `renderHook` + 実際の Zustand ストア (`useCartStore`) を使用

`describe("useFromStore")
  正常系: 初期レンダリングで undefined (ハイドレーション前)                       [P1]
  正常系: useEffect 後にストアの値を返す                                         [P1]
  正常系: ストア値の変更で更新される                                             [P1]
  正常系: コールバック関数で値を変換できる                                       [P2]
  エッジケース: ストアが空の場合 undefined                                       [P2]
  エッジケース: アンマウント時にメモリリークしない                               [P2]`

---

### 1-5. `src/providers/modal-provider.tsx` → `src/providers/modal-provider.test.tsx`

| 環境 | 種別 | 想定テスト数 |
| --- | --- | --- |
| jsdom (`/** @jest-environment jsdom */`) | Component | 12 |

**テスト手法:** `render` + カスタムテストコンポーネントで Provider 内の useModal を検証

`describe("ModalProvider")
  describe("マウント制御")
    正常系: マウント前は children をレンダリングしない (isMounted=false)          [P1]
    正常系: マウント後に children がレンダリングされる                            [P1]

  describe("setOpen")
    正常系: モーダルを開くと isOpen=true                                         [P1]
    正常系: モーダルノードが DOM に描画される                                    [P1]
    正常系: fetchData ありでデータが data にマージされる                         [P1]
    正常系: fetchData なしでモーダルを開ける                                     [P1]
    異常系: modal が null の場合 isOpen が false のまま                          [P2]

  describe("setClose")
    正常系: 閉じると isOpen=false                                               [P1]
    正常系: 閉じると data がリセットされる                                       [P1]

  describe("useModal")
    正常系: Provider 内で context を取得できる                                   [P1]
    異常系: Provider 外で使用するとエラーがスローされる                          [P1]

  describe("ハイドレーション")
    エッジケース: SSR 環境で null を返す                                         [P1]`

**テストインフラ活用:** `createMockUser()` で ModalData.user を構築

---

### 1-6. `src/lib/utils.ts` — 未テスト関数の追加

### `src/lib/utils.test.ts` に追記 (node 環境) — 6 テスト

`describe("cn")
  正常系: 単一クラス名を返す                                                     [P2]
  正常系: 複数クラス名をマージする                                               [P2]
  正常系: Tailwind 競合を解決する ("p-2 p-4" → "p-4")                           [P2]
  正常系: 条件付きクラス名を処理する (clsx 形式)                                [P2]
  正常系: undefined/null/false を無視する                                        [P2]
  エッジケース: 引数なしで空文字を返す                                           [P2]`

### `tests/component/utils-dom.test.ts` (jsdom 環境) — 19 テスト

DOM API 依存関数のテスト。`getDominantColors` は ColorThief + Image API の密結合のためスキップ。

`describe("updateProductHistory")
  正常系: localStorage に新しい variantId が追加される                           [P1]
  正常系: 既存 variantId は先頭に移動 (重複除去)                                [P1]
  正常系: MAX_PRODUCTS (100) 超過で最古エントリ削除                              [P1]
  正常系: localStorage が空なら新規配列を作成                                    [P2]
  異常系: localStorage の値が不正 JSON なら空配列から開始                        [P1]
  エッジケース: 同じ variantId を連続追加しても重複しない                        [P2]
  境界値: 100 件丁度で削除されない                                              [P2]
  境界値: 101 件目の追加で 1 件削除                                             [P2]

describe("downloadBlobAsFile")
  正常系: Blob から ObjectURL が作成される                                       [P2]
  正常系: link.download にファイル名が設定される                                 [P2]
  正常系: link.click() が呼ばれる                                               [P2]
  正常系: URL.revokeObjectURL が呼ばれる                                        [P2]

describe("printPDF")
  正常系: iframe が body に追加される                                            [P2]
  正常系: iframe が非表示に設定される                                            [P2]
  正常系: src に ObjectURL が設定される                                          [P2]
  正常系: onload で print() が呼ばれる                                           [P2]
  正常系: 2秒後に iframe がクリーンアップされる                                  [P2]
  エッジケース: contentWindow が null の場合に print が呼ばれない                [P2]
  正常系: URL.revokeObjectURL が呼ばれる                                        [P2]`

---

## Phase 2: UI コンポーネント (P1) — 想定 ~145 テスト

### コンポーネント選定基準

| 基準 | 重み | 理由 |
| --- | --- | --- |
| 金額計算に関与 | 最高 | 表示金額の誤り = P0 |
| 在庫・数量制御に関与 | 最高 | オーバーセル防止 |
| サーバーアクション呼び出し | 高 | API 連携のエラーハンドリング |
| ユーザー入力 (フォーム) | 高 | Zod バリデーション検証 |
| ステータス遷移制御 | 高 | 不正遷移 = データ不整合 |
| 表示のみ (ロジックなし) | 低 | 対象外 |

**テスト配置:** 全て `tests/component/` 配下。ファイル先頭に `/** @jest-environment jsdom */`

---

### 2-A. Store (顧客向け) コンポーネント

### 2-A-1. `ProductPrice` → `tests/component/store/product-price.test.tsx` (16 テスト)

**ソース:** `src/components/store/product-page/product-info/product-price.tsx`**選定理由:** 価格計算ロジック (割引適用、Decimal.toNumber()、レンジ表示) はビジネスの根幹

`describe("ProductPrice")
  describe("sizeId なし — 価格レンジ表示")
    正常系: 全サイズの min〜max 割引後価格レンジを表示する                       [P0]
    正常系: 全サイズ同一価格時に単一価格を表示する                               [P0]
    正常系: 割引適用後の価格レンジを計算する                                     [P0]
    正常系: 合計在庫数 (pieces) を表示する                                       [P1]
    正常系: "Select a size to see the exact price" を表示する                    [P2]
    正常系: isCard=true でテキストサイズが text-lg                               [P2]
    エッジケース: sizes 空配列で null を返す                                     [P1]

  describe("sizeId あり — 特定サイズ価格表示")
    正常系: 選択サイズの割引適用後価格を表示する                                 [P0]
    正常系: 割引ありで元価格に取り消し線を表示する                               [P1]
    正常系: 割引率 (%) を表示する                                                [P1]
    正常系: useEffect で handleChange(price) と handleChange(stock) が呼ばれる   [P0]
    正常系: quantity=0 で "Out of stock" を表示する                              [P0]
    異常系: 存在しない sizeId で空フラグメントを返す                             [P1]

  describe("境界値")
    境界値: 割引率 0% — 元価格と割引後価格が同じ、取り消し線なし                [P1]
    境界値: 割引率 99% — 価格がほぼゼロに                                       [P1]
    境界値: 在庫 1 — "1 items" 表示                                             [P2]`

**テストインフラ:** `createMockSize()` で sizes 構築, `PRICE_BOUNDARIES.edgeCases`

---

### 2-A-2. `QuantitySelector` → `tests/component/store/quantity-selector.test.tsx` (14 テスト)

**ソース:** `src/components/store/product-page/quantity-selector.tsx`**選定理由:** 在庫超過防止の最終防衛ライン。カート内既存数量との maxQty 連動ロジック

**モック対象:** `@/cart-store/useCartStore`, `@/hooks/useFromStore`

`describe("QuantitySelector")
  正常系: sizeId なしでプレースホルダー (スケルトン) を表示する                  [P1]
  正常系: sizeId ありで数量入力を表示する                                        [P1]
  正常系: +ボタンで handleChange(quantity+1) が呼ばれる                          [P0]
  正常系: -ボタンで handleChange(quantity-1) が呼ばれる                          [P0]
  正常系: quantity=1 で-ボタンが disabled                                        [P1]
  正常系: quantity=stock で+ボタンが disabled                                    [P0]
  正常系: sizeId 変更時に quantity が 1 にリセットされる                         [P0]
  正常系: カート内既存数量がある場合 maxQty = stock - 既存quantity               [P0]
  正常系: maxQty <= 0 の場合、入力値が 0                                        [P0]
  正常系: カート内にない場合 maxQty = stock                                     [P1]
  正常系: maxQty !== stock の場合 "already have X pieces" メッセージ表示        [P1]
  エッジケース: stock=0 の場合の表示                                             [P1]
  エッジケース: quantity > maxQty なら表示値が maxQty に制限                     [P1]
  境界値: stock=1, カート既存=0 → maxQty=1                                     [P1]`

**テストインフラ:** `createMockCartProduct()`, `STOCK_BOUNDARIES`

---

### 2-A-3. `CartProduct` → `tests/component/store/cart-product.test.tsx` (20 テスト)

**ソース:** `src/components/store/cards/cart-product.tsx`**選定理由:** 配送料計算 (ITEM/WEIGHT/FIXED)、数量変更、在庫チェックを含む最高複雑度コンポーネント

**モック対象:** `@/cart-store/useCartStore`, `@/queries/user` (addToWishlist), `react-hot-toast`, `next/image`, `next/link`

`describe("CartProduct")
  describe("配送料計算")
    正常系: ITEM — fee + (qty-1) *extraFee                                     [P0]
    正常系: WEIGHT — fee* weight * quantity                                     [P0]
    正常系: FIXED — quantity に関係なく固定額                                    [P0]
    正常系: FREE (shippingFee=0) → "Free Delivery"                              [P1]
    正常系: 数量変更時に配送料が再計算される                                     [P0]
    境界値: quantity=1 の ITEM で extraFee が加算されない                        [P1]

  describe("数量操作")
    正常系: +ボタンで updateProductQuantity(qty+1) が呼ばれる                    [P0]
    正常系: -ボタン (qty > 1) で updateProductQuantity(qty-1)                    [P0]
    正常系: -ボタン (qty === 1) で removeFromCart が呼ばれる                     [P0]
    正常系: quantity === stock で+ボタンは quantity を増やさない                 [P0]

  describe("在庫切れ表示")
    正常系: stock=0 → "Out of stock"                                            [P0]
    正常系: stock=0 → チェックボックス非表示                                    [P1]
    正常系: stock=0 → 背景が bg-red-100                                         [P2]

  describe("選択操作")
    正常系: チェックボックスで selectedItems に追加                              [P1]
    正常系: 再クリックで selectedItems から除去                                  [P1]

  describe("ウィッシュリスト")
    正常系: ハートアイコンクリックで addToWishlist が呼ばれる                    [P1]
    異常系: addToWishlist 失敗で toast.error                                     [P1]

  describe("表示")
    正常系: 商品名・バリアント名が表示される                                     [P2]
    正常系: price x quantity = totalPrice が表示される                           [P1]
    正常系: 商品ページへのリンクが /product/{slug}/{variantSlug}?size={sizeId}   [P2]`

**テストインフラ:** `createMockCartProduct()`, `PRICE_BOUNDARIES.shippingFee`

---

### 2-A-4. `SizeSelector` → `tests/component/store/size-selector.test.tsx` (8 テスト)

**ソース:** `src/components/store/product-page/product-info/size.selector.tsx`**選定理由:** サイズ選択は価格・在庫・カートデータすべてに影響

`describe("SizeSelector")
  正常系: 全サイズがレンダリングされる                                           [P1]
  正常系: クリックで handleChange("sizeId", id) と handleChange("size", size)   [P0]
  正常系: URL パラメータに size が反映される                                     [P1]
  正常系: 選択中サイズに border-black スタイル適用                               [P2]
  正常系: 初回マウント時に sizeId あれば handleCartProductToBeAddedChange        [P1]
  エッジケース: sizes 空配列で何も表示しない                                     [P2]
  エッジケース: sizeId に一致サイズがない場合 handleChange 未呼び出し           [P1]
  正常系: data-testid が正しく設定される                                         [P2]`

**テストインフラ:** `createMockSize()`

---

### 2-A-5. `ApplyCouponForm` → `tests/component/store/apply-coupon-form.test.tsx` (10 テスト)

**ソース:** `src/components/store/forms/apply-coupon.tsx`**選定理由:** クーポン適用は P0 (不正割引防止)。Zod バリデーション + サーバーアクション

**モック対象:** `@/queries/coupon` (applyCoupon), `react-hot-toast`, `react-hook-form` (実際使用), `next/navigation`

`describe("ApplyCouponForm")
  正常系: クーポンコード入力フィールドがレンダリングされる                       [P1]
  正常系: Apply ボタンがレンダリングされる                                       [P1]
  正常系: 有効コード送信で applyCoupon(coupon, cartId) が呼ばれる               [P0]
  正常系: applyCoupon 成功で setCartData が返却データで更新される                [P0]
  正常系: applyCoupon 成功で toast.success                                       [P1]
  異常系: applyCoupon 失敗で toast.error                                         [P1]
  異常系: 空コードで submit → Zod バリデーションエラー                          [P0]
  異常系: Zod 失敗で FormMessage が表示される                                   [P1]
  正常系: isSubmitting 中はボタンが操作不可                                     [P2]
  エッジケース: 非常に長いクーポンコード入力                                     [P2]`

**テストインフラ:** `createMockCart()`, `COUPON_SCENARIOS`

---

### 2-A-6. `PlaceOrderCard` → `tests/component/store/place-order-card.test.tsx` (12 テスト)

**ソース:** `src/components/store/cards/place-order.tsx`**選定理由:** 注文確定の最終ステップ。金額計算表示 + クーポン割引 + placeOrder 呼び出し

**モック対象:** `@/queries/user` (placeOrder), `@/cart-store/useCartStore`, `react-hot-toast`, `next/navigation`

`describe("PlaceOrderCard")
  正常系: Summary (Subtotal, Shipping, Taxes, Total) を表示する                 [P0]
  正常系: クーポンありで割引額を表示する                                         [P0]
  正常系: クーポンなしで ApplyCouponForm を表示する                             [P1]
  正常系: 割引計算が正しい (storeSubTotal * discount / 100)                     [P0]
  正常系: Place order クリックで placeOrder が呼ばれる                          [P0]
  正常系: 注文成功後に emptyCart() が呼ばれる                                   [P0]
  正常系: 注文成功後に /order/{orderId} へ遷移する                              [P0]
  異常系: shippingAddress=null で toast.error                                    [P1]
  正常系: loading 中はスピナー表示                                              [P2]
  正常系: クーポン情報 (code, discount%, store名) を表示する                    [P1]
  エッジケース: cartItems 空の場合の表示                                         [P1]
  境界値: discount=0 で割引額 $0.00                                             [P2]`

**テストインフラ:** `createMockCart()`, `createMockCoupon()`, `createMockShippingAddress()`, `COUPON_SCENARIOS.discountRates`

---

###  2-A-7. `ProductShippingFee` → `tests/component/store/shipping-fee.test.tsx` ✅ Completed (2026-03-23)

**ステータス:** ✅ **実装済み** (12/12 テスト完了)

**ソース:** `src/components/store/product-page/shipping/shipping-fee.tsx`

**関連ファイル:**
- ユーティリティ: `src/lib/shipping-utils.ts` (`computeShippingTotal` 関数)
- テスト: `tests/component/store/shipping-fee.test.tsx`

**選定理由:** 配送料 3 メソッド分岐の表示正確性・中央集約化された計算ロジックの検証

**実装済みテストケース:**

`describe("ProductShippingFee")
  describe("ITEM method")
    ✅ 正常系: fee === extraFee → 単一料金行                                     [P1]
    ✅ 正常系: fee !== extraFee → 初回料金 + 追加料金の 2 行                     [P1]
    ✅ 正常系: "$fee x qty = $total" 計算式を表示する                            [P0]
    ✅ 正常系: qty=1 で追加料金行なし（formula simplification）                 [P1]

  describe("WEIGHT method")
    ✅ 正常系: "$fee x weight x qty = $total" を表示する                         [P0]
    ✅ 正常系: fee per kg 行を表示する                                            [P1]
    ✅ 正常系: 計算精度の検証（浮動小数点誤差補正）                               [P0]

  describe("FIXED method")
    ✅ 正常系: 固定料金を表示する                                                 [P0]
    ✅ 正常系: "quantity doesn't affect shipping fee" を表示する                  [P1]

  describe("Edge cases")
    ✅ 正常系: 不明 method → null                                                 [P2]
    ✅ 境界値: quantity=0 の処理（`computeShippingTotal` で 0 を返す）          [P2]
    ✅ 統合: `computeShippingTotal` の中央集約パターン検証                       [P0]`

**テストインフラ:** `PRICE_BOUNDARIES.shippingFee` (未使用 - 直接値を指定)

**実装の特徴:**
- `computeShippingTotal` による中央集約化された配送料計算
- `Math.round((result + Number.EPSILON) * 100) / 100` による浮動小数点誤差補正
- 3つの配送方式（ITEM, WEIGHT, FIXED）の完全なカバレッジ
- `@testing-library/react` による DOM 検証とユーザー視点のテスト

**関連コミット:**
- `8ee41ec` - refactor(shipping): consolidate math logic and fix HTML5 compliance
- `7898b9d` - refactor(store): centralize shipping calculation and fix HTML5 compliance
---

### 2-A-8. `CountrySelector` → `tests/component/store/country-selector.test.tsx` (10 テスト)

**ソース:** `src/components/shared/country-selector.tsx`**選定理由:** 国選択は配送料計算に影響

`describe("CountrySelector")
  正常系: 選択された国名とフラグ画像が表示される                                [P1]
  正常系: ボタンクリックでドロップダウンが開く                                   [P1]
  正常系: 国名で検索フィルタリングできる                                         [P1]
  正常系: 国クリックで onChange が呼ばれる                                       [P0]
  正常系: 国選択後にドロップダウンが閉じる                                       [P1]
  正常系: 選択中の国にチェックマーク表示                                         [P2]
  正常系: disabled=true でクリック不可                                           [P2]
  異常系: 検索結果 0 件で "No countries found"                                   [P1]
  正常系: ドロップダウン外クリックで閉じる                                       [P1]
  エッジケース: 空クエリで全国表示                                               [P2]`

---

### 2-B. Dashboard (管理・販売者向け) コンポーネント

### 2-B-1. `OrderStatusSelect` → `tests/component/dashboard/order-status-select.test.tsx` (12 テスト)

**ソース:** `src/components/dashboard/forms/order-status-select.tsx`**選定理由:** 注文ステータス遷移。不正遷移でデータ不整合 (P0)

**モック対象:** `@/queries/order` (updateOrderGroupStatus), `@/hooks/use-toast`, `next/navigation`

`describe("OrderStatusSelect")
  正常系: 現在のステータスタグが表示される                                       [P1]
  正常系: クリックでドロップダウンが開く                                         [P1]
  正常系: 現在ステータス以外の選択肢が表示される                                [P1]
  正常系: 選択肢クリックで updateOrderGroupStatus(storeId, groupId, status)     [P0]
  正常系: 成功後にドロップダウンが閉じる                                        [P1]
  正常系: 成功後に新ステータスが表示される                                       [P0]
  異常系: 失敗で destructive toast が表示される                                  [P1]
  正常系: 再クリックでドロップダウンが閉じる                                     [P2]
  エッジケース: 全 OrderStatus (12 値) がオプションに含まれる                    [P1]
  正常系: storeId と groupId が正しく渡される                                   [P1]
  エッジケース: response が falsy → ステータス未更新                            [P1]
  正常系: エラーの description に error.toString() がセットされる                [P2]`

**テストインフラ:** `ORDER_STATUS_TRANSITIONS.valid/invalid`, `createMockStore()`

---

### 2-B-2. `ProductStatusSelect` → `tests/component/dashboard/product-status-select.test.tsx` (10 テスト)

**ソース:** `src/components/dashboard/forms/product-status-select.tsx`**選定理由:** 注文アイテム単位のステータス管理

`describe("ProductStatusSelect")
  正常系: 現在のステータスタグが表示される                                       [P1]
  正常系: クリックでドロップダウン開く                                           [P1]
  正常系: 選択肢クリックで updateOrderItemStatus が呼ばれる                     [P0]
  正常系: 成功後にステータス更新                                                 [P0]
  正常系: 成功後に router.refresh()                                              [P1]
  異常系: 失敗で destructive toast                                               [P1]
  正常系: storeId と orderItemId が正しく渡される                               [P1]
  エッジケース: 全 ProductStatus 値がオプション                                  [P1]
  正常系: 再クリックでドロップダウン閉じる                                       [P2]
  エッジケース: response が falsy → 未更新                                      [P1]`

---

### 2-B-3. `StoreStatusSelect` → `tests/component/dashboard/store-status-select.test.tsx` (9 テスト)

**ソース:** `src/components/dashboard/forms/store-status-select.tsx`**選定理由:** 店舗の有効/無効切替。無効化すると全商品非表示 (P0)

`describe("StoreStatusSelect")
  正常系: 現在のステータスタグが表示される                                       [P1]
  正常系: クリックでドロップダウン開く                                           [P1]
  正常系: 選択肢クリックで updateStoreStatus が呼ばれる                         [P0]
  正常系: 成功後にステータス更新                                                 [P0]
  異常系: 失敗で destructive toast                                               [P1]
  正常系: storeId が正しく渡される                                              [P1]
  エッジケース: 全 StoreStatus 値がオプション                                    [P1]
  正常系: 再クリックでドロップダウン閉じる                                       [P2]
  エッジケース: response が falsy → 未更新                                      [P1]`

**テストインフラ:** `createMockStore()`

---

### 2-B-4. ステータスタグ群 → `tests/component/shared/status-tags.test.tsx` (12 テスト)

**ソース:** `src/components/shared/order-status.tsx`, `store-status.tsx`, `product-status.tsx`, `payment-status.tsx`**選定理由:** 全ステータス enum 値の表示網羅テスト。値の抜け漏れ検出

`describe("OrderStatusTag")
  正常系: 全 12 OrderStatus 値に正しいラベルが表示される (it.each)               [P1]
  正常系: 各ステータスに対応する bgColor/textColor が適用される                  [P2]
  正常系: Truck アイコンが表示される                                             [P2]

describe("StoreStatusTag")
  正常系: 全 StoreStatus 値に正しいラベルが表示される (it.each)                  [P1]
  正常系: 各ステータスに対応する色クラスが適用される                             [P2]

describe("ProductStatusTag")
  正常系: 全 ProductStatus 値に正しいラベルが表示される (it.each)                [P1]
  正常系: 各ステータスに対応する色クラスが適用される                             [P2]

describe("PaymentStatusTag")
  正常系: 全 PaymentStatus 値に正しいラベルが表示される (it.each)                [P1]
  正常系: 各ステータスに対応する色クラスが適用される                             [P2]`

---

## Phase 3: E2E テスト (P1-P2) — 想定 ~30 テスト

**前提:** `bun run seed:e2e` 済み、`playwright.config.ts` の既存設定を使用

---

### 3-1. `tests/e2e/purchase-flow.spec.ts` ✅ 改善済み (2026-03-23)

**ステータス:** 部分実装済み (4/8 テスト実装, 4/8 保留中)

**実装済みテストケース:**

```
describe("購入フルフロー")
  ✅ 正常系: 商品一覧→詳細→サイズ選択→カート追加→カートページ表示                [P0]
  ✅ 正常系: カート→チェックアウト→住所選択→注文サマリー表示                      [P0]
  ✅ 正常系: 注文確定後に注文詳細ページに遷移する                                  [P0]
  ✅ 正常系: 数量変更がカート合計に反映される                                       [P0]
  ⏸️ 正常系: 複数バリアントをカートに追加し別行で表示                              [P1]
  ✅ 正常系: カートからアイテム削除できる                                           [P1]
  ✅ 正常系: ページリロード後もカートが永続化されている                             [P1]
  ✅ 正常系: 未認証ユーザーがチェックアウトに進むとログインにリダイレクト           [P0]
```

**最近の改善** (Round 7-9):
- ✅ 全テストにサイズ選択ステップを追加（Round 7: 直接実装、Round 8: ヘルパー関数化）
- ✅ `addItemToCart` ヘルパー関数によるDRY化（Round 8）
- ✅ 環境変数処理の改善：空文字列・空白の適切な処理（Round 9）
- ✅ URL パラメータ待機パターンの確立

**実装詳細:**
- **ファイル**: `tests/e2e/purchase-flow.spec.ts`
- **ヘルパー関数**: サイズ選択を統一的に処理する `addItemToCart` パターン
- **環境変数サポート**: `E2E_UNIT_PRICE` での空文字列フォールバック処理

**実装例:**

```typescript
// Helper function for consistent size selection (Lines 56-75)
async function addItemToCart(page: Page, productSlug: string, variantSlug: string) {
  await page.goto(`/product/${productSlug}/${variantSlug}`);
  
  // Select the first available size
  const firstSize = page.locator('[data-testid^="size-option-"]').first();
  await firstSize.click();
  
  // Wait for URL to update with size parameter
  await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
  
  await page.getByTestId("add-to-cart").click();
}

// Environment variable handling with trim and fallback (Lines 38-40)
const envPrice = process.env.E2E_UNIT_PRICE?.trim();
unitPrice = envPrice ? Number(envPrice) : seed.size.price;
```

**関連コミット:**
- Round 7: 直接サイズ選択実装
- Round 8: ヘルパー関数リファクタリング
- `cf86768` - fix(e2e): handle empty E2E_UNIT_PRICE with trim and fallback (Round 9)

---

### 3-2. `tests/e2e/seller-onboarding.spec.ts` (6 テスト)

`describe("Seller オンボーディング")
  正常系: 申請フォーム 4 ステップを順に完了できる                               [P1]
  正常系: 申請後ステータスが "Pending" 表示                                      [P1]
  正常系: 管理者が店舗を "ACTIVE" に変更できる                                  [P0]
  正常系: 承認販売者がダッシュボードにアクセスできる                             [P0]
  正常系: 販売者が商品を作成しストアページに表示される                           [P1]
  異常系: 未承認販売者がダッシュボードにアクセス不可                             [P0]`

---

### 3-3. `tests/e2e/payment-error.spec.ts` (6 テスト)

`describe("決済異常系")
  正常系: 住所未選択で注文ボタン→エラーメッセージ                               [P1]
  正常系: カート空でチェックアウト→リダイレクト                                 [P1]
  正常系: 在庫切れ商品がカートにある場合 "Out of stock"                          [P0]
  正常系: ブラウザバック後に二重送信されない                                     [P0]
  正常系: ネットワークエラー後に再試行できる                                     [P1]
  エッジケース: 決済中ページリロードで状態リカバリ                               [P1]`

---

### 3-4. `tests/e2e/search-filter.spec.ts` (5 テスト)

`describe("検索・フィルタ")
  正常系: 商品名で検索し結果が表示される                                         [P1]
  正常系: カテゴリフィルタで絞り込まれる                                         [P1]
  正常系: フィルタ条件が URL パラメータに反映される                              [P2]
  正常系: ページネーションで次ページに遷移できる                                 [P2]
  エッジケース: 検索結果 0 件で適切なメッセージ表示                              [P2]`

---

### 3-5. `tests/e2e/mobile-responsive.spec.ts` (5 テスト)

`describe("モバイルレスポンシブ")
  正常系: モバイルビューポートで商品カードが正しくレイアウト                     [P1]
  正常系: モバイルでカート操作 (追加・数量変更) が機能する                      [P1]
  正常系: モバイルでナビゲーションメニューが開閉する                             [P2]
  正常系: モバイルでチェックアウトフローが完了できる                             [P1]
  正常系: タブレットビューポートでレイアウト切替                                 [P2]`

---

## テスト数サマリ

| Phase | カテゴリ | 新規テスト数 |
| --- | --- | --- |
| 1-1 | middleware.ts | 18 |
| 1-2 | country.ts | 15 |
| 1-3 | sanitize.ts | 14 |
| 1-4a | useIsMobile | 8 |
| 1-4b | useToast reducer | 14 |
| 1-4c | useFromStore | 6 |
| 1-5 | modal-provider | 12 |
| 1-6 | utils.ts (cn + DOM 関数) | 25 |
| **Phase 1 小計** |  | **112** |
| 2-A (8 種) | Store コンポーネント | 102 |
| 2-B (4 種) | Dashboard + Shared | 43 |
| **Phase 2 小計** |  | **145** |
| 3-1〜3-5 | E2E テスト (5 スイート) | 30 |
| **Phase 3 小計** |  | **30** |
| **総計** |  | **~287** |

**現状 686 + 新規 287 = 973 テスト** → Phase 2 でフォームテスト追加により **1,000+ 到達可能**

---

## 実装順序 (依存関係を考慮)

`Phase 1 (基盤) ────────────────────────────────────
  Step 1:  sanitize.ts             (依存なし、最もシンプル)
  Step 2:  country.ts              (依存なし、fetch モックのみ)
  Step 3:  utils.ts — cn()         (node 環境、依存なし)
  Step 4:  use-toast — reducer     (純粋関数、依存なし)
  Step 5:  middleware.ts           (country.ts に依存 → Step 2 後)
  Step 6:  useIsMobile             (jsdom 環境セットアップ確認)
  Step 7:  useFromStore            (jsdom + Zustand → Step 6 後)
  Step 8:  modal-provider          (jsdom + React context → Step 6 後)
  Step 9:  utils.ts — DOM 関数     (jsdom → Step 6 後)

Phase 2 (コンポーネント) ──────────────────────────
  Step 10: Shared ステータスタグ    (最もシンプル、RTL パターン確立)
  Step 11: ProductPrice            (金額計算の核心)
  Step 12: ProductShippingFee      (配送料表示)
  Step 13: SizeSelector            (価格に影響)
  Step 14: QuantitySelector        (useFromStore 依存 → Step 7 後)
  Step 15: CartProduct             (Step 12, 14 の複合)
  Step 16: ApplyCouponForm         (サーバーアクション + Zod)
  Step 17: PlaceOrderCard          (Step 16 の ApplyCouponForm 含む)
  Step 18: OrderStatusSelect       (サーバーアクション + ドロップダウン)
  Step 19: ProductStatusSelect     (Step 18 と同構造)
  Step 20: StoreStatusSelect       (Step 18 と同構造)
  Step 21: CountrySelector         (独立)

Phase 3 (E2E) ────────────────────────────────────
  Step 22: purchase-flow.spec.ts   (既存 cart-smoke の拡張)
  Step 23: seller-onboarding.spec.ts
  Step 24: payment-error.spec.ts
  Step 25: search-filter.spec.ts
  Step 26: mobile-responsive.spec.ts`

---

## テストインフラ活用マッピング

| インフラ | 使用 Step | 活用方法 |
| --- | --- | --- |
| `createMockUser()` | 5, 8 | 認証ユーザー構築、ModalData.user |
| `createMockStore()` | 18-20 | storeId 取得、初期 status |
| `createMockSize()` | 11, 13 | sizes 配列 (price, discount, quantity) |
| `createMockCartProduct()` | 14, 15 | CartProductType 構築 |
| `createMockCart()` | 16, 17 | CartWithCartItemsType 構築 |
| `createMockCoupon()` | 17 | クーポンデータ構築 |
| `createMockShippingAddress()` | 17 | 配送先住所構築 |
| `AuthTestHelpers.mockAuthenticated()` | 5 | ロール別認証モック |
| `AuthTestHelpers.mockUnauthenticated()` | 5 | 未認証状態モック |
| `AssertionHelpers.mockConsoleError()` | 2, 5 | console.error 抑制 |
| `ORDER_STATUS_TRANSITIONS` | 18 | 有効/無効な遷移パターン |
| `COUPON_SCENARIOS` | 16, 17 | 期限切れ/有効/未開始クーポン |
| `PRICE_BOUNDARIES` | 11, 12, 15 | 金額境界値テスト |
| `STOCK_BOUNDARIES` | 14, 15 | 在庫 0/1/通常/大量 |
| `INVALID_INPUTS` | 3, 16 | 不正入力パターン |
| `TEST_CONFIG.EDGE_CASES` | 3, 9 | 特殊文字・長い文字列 |

---

## Jest 設定に関する注意

現在の `jest.config.js`:

`testEnvironment: "node"
moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }
testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"]`

jsdom 環境のコンポーネントテストは **ファイル先頭に `/** @jest-environment jsdom */` を指定** する方式で対応（`jest.config.js` の変更不要、TESTING_DESIGN.md の方針どおり）。

ただし、`@testing-library/react` 等の依存追加が必要な場合は `bun add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event` を実行する。

---

## 検証方法

1. **Phase 1 完了後:** `bun run test` で全テスト (既存 + 新規 Phase 1) がパスすること
2. **Phase 2 完了後:** `bun run test` で全テスト (既存 + Phase 1 + Phase 2) がパスすること
3. **Phase 3 完了後:** `bun run seed:e2e && bunx playwright test` で E2E テストがパスすること
4. **各 Step 完了後:** `bunx tsc --noEmit && bun run lint` で型エラー・リントエラーなしを確認
5. **最終確認:** `bun run test -- --coverage` でカバレッジレポートを生成し、ビジネスロジック領域が 80%+ であることを確認
