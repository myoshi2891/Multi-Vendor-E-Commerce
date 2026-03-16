# 包括的テスト実装計画書 (Comprehensive Test Implementation Plan)

## 1. 目的とスコープ
本計画書は、Multi-Vendor EC プロジェクトにおいて現在不足しているテストケースを特定し、世界トップクラスの品質基準（Antigravity Standard）を満たすための実装ロードマップを定義するものである。

### 品質基準 (Antigravity Standard)
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
