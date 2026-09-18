# Multi-Vendor E-Commerce プロジェクトドキュメント

本ドキュメントは、開発チームが本リポジトリの全体像・アーキテクチャ・機能・品質状況を把握するための包括的な参照資料である。個別の詳細は各セクション末尾のリンク先（`.claude/steering/`、`specs/`、`docs/testing/` 等）を参照すること。

---

## 00. 概要

### 背景・目的・ゴール

本プロジェクトは、複数の独立した販売者（ベンダー）が単一プラットフォーム上に出品し、顧客が横断的に商品を検索・購入できるマルチベンダー型 E コマースマーケットプレイスである。Next.js 16（App Router）を基盤に、Prisma ORM 経由で PostgreSQL（Neon + Prisma Accelerate）にアクセスし、認証は Clerk、決済は Stripe / PayPal の二系統に対応する。

現フェーズのゴールは、顧客のチェックアウト完了率向上とカート離脱率改善、販売者の商品・在庫管理の操作性向上、管理者のカタログ維持コスト低減である。多通貨対応・税計算エンジン・高度な分析ダッシュボード・サードパーティ配送キャリア連携は現フェーズのスコープ外と明示されている（`.claude/steering/product.md`）。

### ターゲットユーザーと提供価値

| ロール | 識別子 | 概要 | 提供価値 |
|---|---|---|---|
| 顧客 | `USER` | 多様な店舗から商品を検索・カート追加・決済する一般ユーザー | 複数店舗を横断した一元的な購買体験、注文追跡、レビュー・ウィッシュリスト機能 |
| 販売者 | `SELLER` | 自店舗の商品・在庫・配送ルール・クーポンを管理する中小事業者 | 自店舗完結型の商品/在庫/注文/クーポン管理ダッシュボード |
| 管理者 | `ADMIN` | カテゴリ・サブカテゴリ・オファータグ・店舗ステータスを管理する運営者 | プラットフォーム全体のカタログ統制、横断的な注文・店舗監視 |

> 参照: [`.claude/steering/product.md`](../.claude/steering/product.md)、ロードマップは `docs/architecture/saas-roadmap.md`、仕様の Single Source of Truth は `specs/multi-vendor-ecommerce/`。

---

## 01. 主な機能

### 顧客向け機能（`src/app/(store)/`）

| 機能カテゴリ | 概要 | 主要な入出力/振る舞い | 関連ファイルパス |
|---|---|---|---|
| ホーム | トップページ。おすすめ商品・特集カテゴリを表示 | `getHomeDataDynamic` 等で商品・カテゴリを取得し SSR 描画 | `src/app/(store)/page.tsx`, `src/queries/home.ts` |
| 商品閲覧・検索（Browse） | カテゴリ/価格/サイズ/色での絞り込み、ソート、ページネーション | URL パラメータを `normalizePageParam` 等で正規化し、カテゴリツリー（materialized path）で解決 | `src/app/(store)/browse/page.tsx`, `src/lib/category-tree.ts`, `src/queries/product.ts` |
| 商品詳細 | 商品スラッグ→バリアントスラッグへリダイレクトし、バリアント別詳細を表示 | 最初のバリアントへ自動リダイレクト | `src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx` |
| 商品比較 | 選択した複数商品をグリッドで比較 | クライアント側 `localStorage`（`useCompareStore`）で完結、サーバークエリは商品取得のみ | `src/app/(store)/compare/page.tsx` |
| オファー・割引一覧 | プラットフォーム全体の割引タグ一覧 | `getAllOfferTags` 取得、絞込は `/browse` に委譲 | `src/app/(store)/offers/page.tsx` |
| カート | カート内容表示、国別送料計算 | Zustand 永続ストア（`useCartStore`）で追加/更新/削除 | `src/app/(store)/cart/page.tsx`, `src/cart-store/useCartStore.ts` |
| チェックアウト | 未ログイン時は `/cart` へリダイレクト | カート・配送先住所を集約して決済へ | `src/app/(store)/checkout/page.tsx` |
| 店舗ページ | 特定店舗の商品一覧・フィルタ・ソート | `getStorePageDetails` | `src/app/(store)/store/[storeUrl]/page.tsx` |
| プロフィール／注文履歴／ウィッシュリスト／フォロー中の店舗／レビュー履歴 | 自分に紐づく各種一覧（ページネーション） | `getUserOrders` / `getUserReviews` 等 | `src/app/(store)/profile/**` |
| メッセージ（DM） | 購入者⇔店舗のスレッド | `getUserConversations` | `src/app/(store)/profile/messages/page.tsx`, `src/queries/message.ts` |
| 配送先住所・支払い履歴・アカウント設定 | 住所 CRUD、決済履歴、Clerk `<UserProfile/>` 埋め込み | Clerk Webhook で `User` テーブルへ自動同期 | `src/app/(store)/profile/{addresses,payment,settings}/page.tsx` |
| 注文追跡 | ゲストでも利用可能な追跡フォーム | 公開ページ | `src/app/(store)/track-order/page.tsx` |
| サポート系（FAQ／お問い合わせ／返品交換／紛争申立等） | 静的/フォーム系ページ群 | `SupportForm` 経由でサーバーアクションへ送信 | `src/app/(store)/{dispute,returns-exchange,customer-service,faqs,contact,legal,about}/` |

### 販売者向け機能（`src/app/dashboard/seller/`）

| 機能カテゴリ | 概要 | 主要な入出力/振る舞い | 関連ファイルパス |
|---|---|---|---|
| 店舗一覧・新規作成 | 自分が所有する店舗一覧、新規作成フォーム | `db.store.findMany({ where: { userId } })` | `stores/page.tsx`, `stores/new/page.tsx` |
| 商品管理 | 商品一覧・新規作成・バリアント追加 | `getAllStoreProducts`, `getAllCategories`, `getAllOfferTags` | `stores/[storeUrl]/products/**` |
| 在庫管理 | 在庫アラート・しきい値設定・インライン編集 | `requireStoreOwner` で所有権を再検証、`getStoreInventory` | `stores/[storeUrl]/inventory/page.tsx`, `src/queries/inventory.ts` |
| 注文管理 | 店舗宛の注文一覧 | `getStoreOrders`（件数上限あり） | `stores/[storeUrl]/orders/page.tsx` |
| クーポン管理 | 店舗単位のクーポン CRUD | `getStoreCoupons` | `stores/[storeUrl]/coupons/**` |
| 配送設定 | デフォルト配送情報・配送料金テーブル | `getStoreDefaultShippingDetails`, `getStoreShippingRates` | `stores/[storeUrl]/shipping/page.tsx` |
| 店舗設定・メッセージ | 店舗プロフィール編集、購入者との会話 | `getStoreConversations` | `stores/[storeUrl]/{settings,messages}/page.tsx` |

### 管理者向け機能（`src/app/dashboard/admin/`）

| 機能カテゴリ | 概要 | 主要な入出力/振る舞い | 関連ファイルパス |
|---|---|---|---|
| 管理ダッシュボード | 統計カード・売上推移・最近の注文/店舗 | `getAdminDashboardStats`, `getSalesOverTime` | `admin/page.tsx`, `src/queries/dashboard.ts` |
| カテゴリ管理 | 階層カテゴリ（materialized path）の一覧・CRUD | `getAllCategories` + `flattenCategoryTree` | `admin/categories/**`, `src/lib/category-tree.ts` |
| オファータグ管理 | 全体割引/特集タグ CRUD | `getAllOfferTags` | `admin/offer-tags/**` |
| クーポン管理（全体） | 全店舗横断のクーポン一覧・作成 | `getAllCoupons` | `admin/coupons/**` |
| 注文管理（全体） | 全注文の一覧、ステータス/支払いフィルタ | `getAllOrders` + `AdminOrderFilterSchema` | `admin/orders/page.tsx` |
| 店舗管理（全体） | 全店舗一覧（承認/監視用途） | `getAllStores` | `admin/stores/page.tsx` |

### 横断的な基盤機能

| 機能 | 概要 | 関連ファイル |
|---|---|---|
| カート状態管理 | Zustand + persist によるクライアント側カート永続化 | `src/cart-store/useCartStore.ts` |
| Stripe 決済 | PaymentIntent 作成・決済実行 | `src/queries/stripe.ts` |
| PayPal 決済 | 注文作成・キャプチャ | `src/queries/paypal.ts` |
| Webhook: Stripe | `payment_intent.succeeded/failed`, `charge.refunded` を受信し `PaymentStatus` を更新 | `src/app/api/webhooks/stripe/route.ts` |
| Webhook: PayPal | `PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED` を署名検証の上で反映 | `src/app/api/webhooks/paypal/route.ts` |
| Webhook: Clerk（ユーザー同期） | Svix 署名検証、`user.created/updated/deleted` を Prisma `User` に同期 | `src/app/api/webhooks/route.ts` |

補足: DB に依存する `page.tsx` はほぼ全て `export const dynamic = "force-dynamic"` を付与する規約になっている（`.claude/steering/tech.md` 参照）。

---

## 02. アーキテクチャ

### システム全体設計と責務分離

- **プレゼンテーション層**: `src/app/` の Server Component が主体。UI コンポーネントから `src/queries/` を直接 import することは禁止されており、必ず Server Component 経由でサーバーアクションを呼び出す。
- **アプリケーション層（Server Actions）**: `src/queries/` に集約。認可は `src/lib/auth-guards.ts` の `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner` を通じて一元検証する。外部呼び出し（Prisma / Clerk / Stripe / PayPal）は `try/catch` でラップする。
- **データアクセス層**: `src/lib/db.ts` の Prisma シングルトン経由のみ。`withAccelerate()` 拡張を使用し、CI のビルド時に DB 接続が発生しないよう **遅延初期化（Proxy によるレイジー生成）** を採用している点が特徴的である（後述）。
- **外部サービス層**: Clerk（認証）、Stripe / PayPal（決済）、Cloudinary（画像）、Svix（Webhook 署名検証）。

```mermaid
flowchart TB
    subgraph Client["クライアント（ブラウザ）"]
        Browser["顧客/販売者/管理者 UI"]
    end

    subgraph NextApp["Next.js 16 App Router"]
        Middleware["src/middleware.ts\nClerk clerkMiddleware"]
        Pages["Server Components\nsrc/app/**/page.tsx"]
        ApiRoutes["Route Handlers\nsrc/app/api/**"]
        Queries["Server Actions\nsrc/queries/**\n(auth-guards で認可)"]
        CartStore["Zustand Store\nsrc/cart-store"]
    end

    subgraph DataLayer["データアクセス層"]
        DbSingleton["Prisma シングルトン\nsrc/lib/db.ts"]
    end

    subgraph External["外部サービス"]
        ClerkSvc["Clerk\n認証・ユーザー管理"]
        StripeSvc["Stripe"]
        PayPalSvc["PayPal"]
        Cloudinary["Cloudinary\n画像ホスティング"]
        Svix["Svix\nWebhook署名検証"]
    end

    Postgres[("PostgreSQL (Neon)\n+ Prisma Accelerate")]

    Browser -->|"HTTP"| Middleware
    Middleware -->|"/dashboard, /checkout, /profile を保護"| Pages
    Browser -.->|"クライアント状態"| CartStore
    Pages --> Queries
    Pages --> ApiRoutes
    Queries --> DbSingleton
    ApiRoutes --> DbSingleton
    DbSingleton --> Postgres

    Queries <--> ClerkSvc
    Queries <--> StripeSvc
    Queries <--> PayPalSvc
    Pages --> Cloudinary
    ApiRoutes <--> Svix
    StripeSvc -->|"Webhook"| ApiRoutes
    PayPalSvc -->|"Webhook"| ApiRoutes
    ClerkSvc -->|"Webhook"| ApiRoutes
```

### シーケンス図: チェックアウト〜決済確定フロー

```mermaid
sequenceDiagram
    actor U as 顧客
    participant CO as チェックアウトページ
    participant QA as Server Action (queries/order.ts)
    participant PG as Stripe/PayPal
    participant WH as Webhook Route Handler
    participant DB as PostgreSQL (Prisma)

    U->>CO: カート内容確認・配送先選択
    CO->>QA: 注文作成リクエスト
    QA->>DB: $transaction で Order/OrderGroup/OrderItem 作成、在庫減算
    DB-->>QA: 作成済み Order
    QA->>PG: PaymentIntent/PayPalオーダー作成
    PG-->>U: 決済フォーム表示・入力
    U->>PG: カード情報/PayPal認証を送信
    PG-->>WH: Webhook通知（payment_intent.succeeded 等）
    WH->>WH: 署名検証（Stripe Signature / PayPal Webhook ID）
    WH->>DB: PaymentStatus / OrderStatus を更新
    DB-->>U: 注文確定（プロフィール/注文履歴に反映）
```

### データフロー図: カートから注文確定まで

```mermaid
flowchart LR
    Cart["Cart\n(userId 1:1)"] --> CartItem["CartItem\n(variant 単位)"]
    CartItem -->|"チェックアウト"| Order["Order\n(1顧客の注文全体)"]
    Order --> OrderGroup["OrderGroup\n(店舗単位に分割)"]
    OrderGroup --> OrderItem["OrderItem\n(バリアント単位, status: ProductStatus)"]
    Order --> PaymentDetails["PaymentDetails\n(1:1)"]
    PaymentDetails -->|"Webhook更新"| PaymentStatus["PaymentStatus"]
    OrderGroup -->|"任意"| Coupon["Coupon\n(STORE/PLATFORM scope)"]
```

**アーキテクチャ上の重要な設計判断**

| 判断 | 内容 |
|---|---|
| Prisma シングルトンの遅延初期化 | `withAccelerate()` をモジュール評価時に即実行すると `next build` の Collecting page data フェーズで全ルート分の接続が走り、CI のスタブ `DATABASE_URL` で失敗する。`Proxy` でラップし初回プロパティアクセス時にのみクライアントを生成することで回避している（`src/lib/db.ts`） |
| DB 依存ページの `force-dynamic` 宣言 | Next.js 16 のデフォルトの静的化を避け、ビルド時に DB へ到達しないようにする規約（ストアフロント公開ページの SSG/ISR は放棄） |
| 認可ガードの try/catch 外配置 | 認可エラー（"Unauthenticated." 等）を汎用 DB エラーメッセージで上書きしないための意図的設計 |
| CSRF 対策 | 専用トークンモジュールを新設せず、Next.js 16 Server Actions の Origin/Host 検証と Clerk `SameSite=Lax` セッション Cookie に依拠（[ADR-001](architecture/decisions/001-csrf-policy.md)） |

> 参照: [`.claude/steering/tech.md`](../.claude/steering/tech.md)、[`.claude/steering/structure.md`](../.claude/steering/structure.md)

---

## 03. 構成と制約

### 技術スタック

| カテゴリ | 技術 | バージョン（package.json 実測） |
|---|---|---|
| Frontend | Next.js（App Router） | `~16.2.12` |
| Runtime | React | `^19` |
| UI | Tailwind CSS + shadcn/ui（Radix UI primitives） | Tailwind `^3.4.1` |
| 認証 | Clerk | `@clerk/nextjs ^7.5.0` |
| DB | PostgreSQL (Neon) + Prisma ORM + Prisma Accelerate | `prisma 5.22.0` |
| 決済 | Stripe / PayPal | `stripe ^17.4.0`, `@paypal/react-paypal-js ^8.7.0` |
| 画像 | Cloudinary | `next-cloudinary ^6.6.2` |
| Webhook 検証 | Svix | `^1.24.0` |
| 状態管理 | Zustand | `^5.0.0` |
| フォーム | React Hook Form + Zod | `^7.51.5` / `^3.25.0` |
| テスト | Jest + Testing Library / Playwright / testcontainers | `jest ^30.0.5`, `@playwright/test ^1.57.0`, `@testcontainers/postgresql ^10.13.2` |
| Lint/静的解析 | ESLint 9（flat config）+ SonarCloud（CI, non-blocking） | `eslint ^9` |
| パッケージマネージャー | Bun | — |

### ディレクトリ構成（主要ディレクトリの役割）

| ディレクトリ | 役割 |
|---|---|
| `src/app/(store)/` | 顧客向けページ（ホーム・browse・カート・チェックアウト・プロフィール・サポート系） |
| `src/app/(auth)/` | Clerk 認証ページ（sign-in・sign-up） |
| `src/app/(fullscreen)/` | ヘッダー等なしの単独レイアウト（注文確認・出店登録フロー） |
| `src/app/dashboard/admin/` | 管理者ダッシュボード |
| `src/app/dashboard/seller/stores/[storeUrl]/` | 販売者ダッシュボード |
| `src/app/api/` | Route Handler（商品検索・Webhook・Cookie 設定） |
| `src/queries/` | サーバーアクション（`"use server"`）。UI から直接 import 禁止 |
| `src/lib/` | 共有ユーティリティ（`db.ts`, `auth-guards.ts`, `schemas.ts`, `category-tree.ts`, `shipping-utils.ts`, `order-settlement.ts`, `payment-status.ts`, `coupon-utils.ts`, `pii.ts`, `utils.ts` 等） |
| `src/components/ui/` | shadcn/ui コンポーネント群 |
| `src/components/dashboard/` | ダッシュボード固有 UI |
| `src/components/store/` | 顧客向け UI |
| `src/cart-store/` | Zustand カートストア（`@/store` は `src/components/store/` を指すため注意） |
| `src/compare-store/` | 商品比較用 Zustand ストア |
| `src/config/` | テスト共通インフラ（ファクトリ・ヘルパー・シナリオ・定数） |
| `prisma/` | Prisma スキーマ・マイグレーション履歴 |
| `tests/e2e/` | Playwright E2E テスト |
| `specs/multi-vendor-ecommerce/` | SDD 仕様書（Single Source of Truth） |
| `docs/` | アーキテクチャ・マイグレーション・テスト設計記録 |
| `.claude/steering/` / `.claude/rules/` | チーム横断ルール・ガードレール |

### 技術的制約・環境制約・依存関係

| 項目 | 内容 |
|---|---|
| `reactStrictMode` | `false`（`next.config.mjs`） |
| Elasticsearch | 現在コメントアウト中（`src/lib/elastic-search.ts`）。全文検索は PostgreSQL の `tsvector/tsquery`（`'simple'` トークナイザー、`$queryRaw` + `Prisma.sql` でパラメータ化） |
| 金額精度 | `Float` 禁止。金額フィールドは `Decimal(12,2)` 必須、演算は `Prisma.Decimal` メソッドのみ（中間集計での `.toNumber()` 積み上げ禁止。唯一の例外は E2E の表示文字列検算） |
| Category モデルの二重構造 | 隣接リスト＋materialized path（Phase A）から `categoryNodeId` への統合（Phase C）へ移行中。旧 `categoryId` 固定 FK と新 `categoryNodeId`（nullable）が共存する過渡期設計（ADR-006 参照） |
| セキュリティヘッダー | `next.config.mjs` の `headers()` で `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` を全ルートに付与。HSTS は `NODE_ENV=production` かつ Vercel preview 以外かつ環境変数 opt-in 時のみ付与（build 時に 1 度評価されるため実行時の env 変更は反映されない） |
| CSRF | 専用トークンモジュール不採用。Next.js Server Actions の Origin/Host 検証 + Clerk セッション Cookie に依拠 |
| Docker 開発環境 | `make setup` でフルスタック（app + ローカル PostgreSQL）起動可能 |
| CI 制約 | `next build` を `DATABASE_URL=postgresql://stub:stub@localhost:5432/stub` で実行するため、DB 依存ページは `force-dynamic` 宣言が必須 |

### 認可ガードヘルパー一覧（`src/lib/auth-guards.ts`）

| 関数 | 役割 | エラーメッセージ |
|---|---|---|
| `requireUser()` | Clerk `currentUser()` 取得、未認証なら例外 | `"Unauthenticated."` |
| `requireAdmin()` | `requireUser` + ロール `ADMIN` 検証 | `"Only admins can perform this action."` |
| `requireSeller()` | `requireUser` + ロール `SELLER` 検証 | `"Only sellers can perform this action."` |
| `requireStoreOwner(storeUrl)` | `requireSeller` + 指定店舗の所有権検証、`{ user, store }` を返す | `"Forbidden: store not owned by current user."` |

承認済み例外（`src/queries/profile.ts` 5 箇所、`src/queries/paypal.ts` 1 箇所）は詳細な理由と共に [`.claude/steering/tech.md`](../.claude/steering/tech.md) の「認可ガードの承認済み例外」に記載されている。

### ミドルウェアで保護されているルート（`src/middleware.ts`）

- `/dashboard`, `/dashboard/(.*)`
- `/checkout`
- `/profile`, `/profile/(.*)`

### API Route 一覧（`src/app/api/`）

| パス | メソッド | 役割 |
|---|---|---|
| `api/index-products` | POST | 商品検索サジェスト（名前/ブランド/バリアント一致、フォールバックで部分一致） |
| `api/search-products` | GET | PostgreSQL 全文検索（`to_tsvector`/`plainto_tsquery`、`ts_rank` で関連度順、最大 50 件） |
| `api/setUserCountryInCookies` | POST | クライアント国情報を検証（`isCountry`, 文字数上限）の上で Cookie 保存 |
| `api/webhooks` | POST | Clerk（Svix）ユーザー同期 Webhook |
| `api/webhooks/stripe` | POST | Stripe 決済 Webhook |
| `api/webhooks/paypal` | POST | PayPal 決済 Webhook |

> 参照: [`.claude/steering/tech.md`](../.claude/steering/tech.md)、[`.claude/steering/structure.md`](../.claude/steering/structure.md)、`docs/architecture/decisions/`

---

## 04. 品質と未検証の範囲

> 数値は `docs/testing/QA_HANDOFF.md`（テスト統計 SSOT、2026-09-04 時点）に基づく。同ファイルは各セルの変更履歴が追記され続ける形式のため、最新値は同ファイルを直接参照すること。

### テスト方針と現在の保証状況

| レイヤー | 件数 | 備考 |
|---|---|---|
| Jest unit/component | 2184 passed / 2187 total（199 スイート） | `jest.config.js`。`testEnvironment: node`。`tests/e2e/`・`tests/integration/` は除外 |
| Jest Integration | 136 テスト / 16 スイート | `jest.integration.config.js`。testcontainers PostgreSQL、`maxWorkers: 1`（DB を直列共有） |
| Jest スナップショット | 127（shadcn/ui 49/49 プリミティブ） | |
| Playwright E2E（メイン） | 66 tests/browser × 3 ブラウザ = 198、30 ファイル | chromium/firefox/webkit、`workers: 1` |
| Playwright Visual (VRT) | 4 spec / 5 test（chromium 限定） | cart/checkout/browse/商品詳細 |
| Playwright a11y | 7 spec（chromium 限定） | |
| 型エラー | 0 件 | |
| lcov カバレッジ（2026-09-03 実測） | Statements 75.32% / Branches 60.8% / Functions 65.9% / Lines 74.8% | |
| カバレッジマトリクス（8 カテゴリ×10 ドメイン） | 18/80 セル (23%) | `docs/testing/COVERAGE_REPORT.md` |

**現在保証されている範囲**:
- 認可/IDOR: `src/queries/*.test.ts` 14 ファイル中 9 ファイルが認証・ロール・IDOR テストを完備。過去に発見された IDOR（PayPal/Stripe の orderId 所有権チェック欠落、review upsert、クーポンの cross-store/PLATFORM hijack、`applyCoupon` の TOCTOU レース等）は修正済み。
- 決済 Webhook の冪等性（実 DB で検証）。
- カート→注文確定のオーバーセル防止・在庫減算・クーポン適用のトランザクション整合性。
- カテゴリツリー機能（隣接リスト+materialized path）のツリー編集不変条件、E2E 含め 3 ブラウザで緑確認済み。
- shadcn/ui プリミティブ 49/49 のスナップショット網羅。

### 未検証の範囲・エッジケース・既知の制限事項・技術的負債

| 区分 | 内容 |
|---|---|
| Open Issue（優先度1・未着手） | `/dashboard/seller` 系ルートで本番 SSR 時に `next-cloudinary` の `CldUploadWidget` がサーバー評価され `ReferenceError: self is not defined` の可能性（ログのみ、テスト失敗は未確認） |
| Open Issue（優先度2） | a11y `color-contrast` 負債。`/checkout`・`/profile`・`/seller/apply` で WCAG 4.5:1 未達。E2E では該当ルールを意図的に無効化中 |
| Open Issue（優先度3） | ローカル Firefox 実行時に E2E navigation がハングする事象（dev 環境 HMR 起因と**推定**、CI は本番ビルドのため影響なし）。3 件を local firefox のみ skip 中 |
| Open Issue（優先度4・未着手） | Bundle Size の継続監視が未整備 |
| 設計課題（`08-open-questions.md`） | `applyCoupon` の `cart.total` に対する楽観的並行制御が未実装（読み取り→書き込み間のロストアップデートの可能性、修正には `$transaction` 化が必要） |
| 設計課題 | `applyCoupon` のドメインエラー 6 種が汎用メッセージに上書きされる（`isDomainError` 未適用） |
| セキュリティギャップ | Security 観点のマトリクスカバー率 2/10（20%）。API routes/pages/store/dashboard への認可テスト横展開は未実施 |
| セキュリティギャップ | レート制限は API ルート 3 本（index-products/search-products/setUserCountryInCookies）のみ計画済み。ログイン・クーポン総当たり・注文追跡照合・サポート起票・newsletter は未計画 |
| セキュリティギャップ | XSS（商品名/レビュー/説明文）、Prisma 不正クエリ耐性の網羅テストが薄い |
| カバレッジホットスポット | E2E/Visual/a11y/API・Contract 行はいずれも pages 列のみ 1/10（10%）でカバー。store/dashboard/shared/hooks/lib 列は未着手 |
| カバレッジホットスポット | Performance 行は全ドメイン 0/10（0%）で唯一の完全未着手カテゴリ。Lighthouse 計測は browse ページのみ（warn-only ベースライン） |
| 技術的負債 | `saleEndDate` の FormField に `<FormMessage />` が未実装。既存 DB に旧形式（オフセットなし）の値が万一存在すると編集画面から保存不能（実データには無い見込みだが未検証） |
| 技術的負債 | SonarCloud Issue 8 件（sort 比較関数・正規表現バックトラッキング・認知的複雑度超過等）が未対応で残存（2026-09-04 時点） |
| 技術的負債 | カテゴリツリー移行 Phase C（Step 5 以降）は未着手、オペレーター承認待ち |
| Skip 中のテスト | `prisma/seed/__tests__/idempotency.test.ts` を含む 3 件（`SKIP_DB_TESTS` 環境変数で `describe.skip`） |

> 参照: `docs/testing/QA_HANDOFF.md`（SSOT）、`docs/testing/COVERAGE_REPORT.md`、`docs/testing/SECURITY_GAP_REPORT.md`、`docs/testing/QA_TEST_PERSPECTIVES.md`、`specs/multi-vendor-ecommerce/08-open-questions.md`

---

## 05. 参照コード

| パス | 役割 | 主要ロジック |
|---|---|---|
| `src/lib/db.ts` | Prisma シングルトン | `Proxy` による遅延初期化で `withAccelerate()` の即時接続を回避、開発時は `globalThis.prisma` を再利用 |
| `src/lib/auth-guards.ts` | 認可ガード集約 | `requireUser`/`requireAdmin`/`requireSeller`/`requireStoreOwner` |
| `src/lib/schemas.ts` | Zod バリデーションスキーマ | フォーム/サーバーアクション共通の入力検証 |
| `src/lib/category-tree.ts` | カテゴリ階層ロジック | materialized path の解決・`flattenCategoryTree` |
| `src/lib/shipping-utils.ts` | 配送料計算の一元管理 | `computeShippingTotal`（ITEM/WEIGHT/FIXED） |
| `src/lib/order-settlement.ts` / `payment-status.ts` | 決済確定・ステータス変換 | Webhook からのステータスマッピング |
| `src/lib/utils.ts` | 汎用ユーティリティ | `parseUserCountryCookie`, `normalizePageParam`, `normalizePositiveIntParam` |
| `src/middleware.ts` | Clerk 認証ミドルウェア | 保護ルートの `auth.protect()`、`userCountry` Cookie の初期セット |
| `src/queries/product.ts` / `category.ts` / `inventory.ts` | 商品ドメインのサーバーアクション | 商品 CRUD・在庫管理・カテゴリ CRUD |
| `src/queries/store.ts` / `store-dashboard.ts` | 店舗ドメイン | 店舗情報取得・ダッシュボード集計 |
| `src/queries/order.ts` / `stripe.ts` / `paypal.ts` / `coupon.ts` | 注文/決済ドメイン | 注文確定トランザクション、決済 API 連携、クーポン適用 |
| `src/queries/user.ts` / `profile.ts` / `country.ts` | ユーザー/プロフィールドメイン | 住所管理・プロフィール集計 |
| `src/queries/message.ts` / `review.ts` / `support.ts` | コミュニケーションドメイン | DM・レビュー・サポートチケット |
| `src/queries/dashboard.ts` / `home.ts` | 全体集計ドメイン | 管理者統計・ホーム画面データ |
| `src/cart-store/useCartStore.ts` | カート状態管理 | Zustand + persist、`addToCart`/`updateProductQuantity`/`removeFromCart` |
| `src/app/api/webhooks/{route,stripe/route,paypal/route}.ts` | Webhook 受信 | Svix/Stripe/PayPal 署名検証とステータス反映 |
| `src/app/api/search-products/route.ts` | 全文検索 API | `$queryRaw` + `Prisma.sql` によるパラメータ化 tsvector 検索 |
| `prisma/schema.prisma` | データモデル定義 | 全モデル・enum・リレーション・制約の SSOT |
| `src/config/test-*.ts` | テスト共通インフラ | 型安全ファクトリ・モックヘルパー・シナリオデータ |

### Prisma 主要モデル概要

| モデル | 概要 | 主なリレーション先 |
|---|---|---|
| `User` | `role: Role`（USER/ADMIN/SELLER） | `Store`, `Cart`(1:1), `Order`, `Wishlist`, `Review`, `Conversation` |
| `Store` | `status: StoreStatus` | `User`(所有者), `Product`, `ShippingRate`, `OrderGroup`, `Coupon` |
| `Category` | 自己参照 parent/children（materialized path、深度上限4） | `SubCategory`, `Product`（`categoryId`/`categoryNodeId` 移行中） |
| `Product` → `ProductVariant` → `Size`/`Color`/`ProductVariantImage` | 価格・在庫・画像はバリアント単位 | `Store`, `Category`, `Review`, `Wishlist`, `FreeShipping`(1:1) |
| `Cart` → `CartItem` | ユーザー 1:1、店舗ごとに行が分かれる | `User`, `Store`, `Coupon`(optional) |
| `Order` → `OrderGroup`（店舗単位）→ `OrderItem`（バリアント単位） | `PaymentDetails`(1:1) | `ShippingAddress`, `Coupon`, `Conversation`, `SupportTicket` |
| `Coupon` | `scope: CouponScope`（STORE/PLATFORM） | `Store`(optional), `OrderGroup`, `User`（多対多）, `Cart`（多対多） |

> 完全なモデル一覧・enum・制約は `prisma/schema.prisma`（834 行）を正とする。ER 図は `docs/architecture/data-model.drawio` を `bun run erd:generate` で再生成する（[`.claude/rules/03-data-model-diagram-sync.md`](../.claude/rules/03-data-model-diagram-sync.md)）。

---

## 補足

本ドキュメントは 2026-09-18 時点のコードベース調査（`prisma/schema.prisma`、`src/middleware.ts`、`src/lib/`、`src/app/`、`docs/testing/`、`package.json`、`next.config.mjs` 等）に基づき作成した。テスト統計・Open Issue 等の数値は変動が速いため、最新情報は `docs/testing/QA_HANDOFF.md`（SSOT）を都度参照すること。ソースコードから直接確認できない意図（設計判断の背景等）については、可能な限り既存の ADR・steering ドキュメントの記述を引用し、推測を含む箇所には明示的に「推定」と記載した。
