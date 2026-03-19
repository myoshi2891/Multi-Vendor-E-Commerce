# Multi-Vendor E-Commerce Project Handoff Instructions

## 1. プロジェクト概要
Next.js 14 (App Router), TypeScript, Prisma (PostgreSQL), Clerk (Auth), Stripe/PayPal を使用したマルチベンダーEコマースマーケットプレイスです。

### 技術スタック
- **Frontend**: Next.js 14, Tailwind CSS, shadcn/ui
- **Backend**: Server Actions, Prisma ORM (Neon PostgreSQL)
- **Auth**: Clerk (Role-based: USER, SELLER, ADMIN)
- **Test**: Playwright (E2E), Jest (Unit)
- **Manager**: Bun

---

## 2. 現在の進捗状況
フェーズ3（E2Eテストの実装）およびコードレビュー後のリファクタリングを実施中です。

### 完了したタスク
- [x] **Prismaクエリのエラーハンドリング**: `getAllCountries` 等の関数化と try-catch 実装。
- [x] **型安全性の向上**: UIコンポーネント (size.selector, quantity-selector等) からの `any` 削除。
- [x] **Middlewareテストの修正**: Clerk と Next.js の型不整合を解消。
- [x] **Stripeテストのリファクタリング**: `jest.mocked` を使用した安全なモックへの移行。
- [x] **ImageUploadの修正**: Cloudinary の型定義適用と `data-testid` の統一 (`n-mock-input-*`)。

### 進行中のタスク
- [ ] **E2Eテスト (Phase 3)**: セラーオンボーディングおよび購入フローの検証。

---

## 3. 現在直面している課題
`tests/e2e/seller-onboarding.spec.ts` において、マルチブラウザテスト実行時に以下の問題が発生しています。

- **Chromium**: 正常終了。
- **Firefox**: `/seller/apply` への遷移でタイムアウト。
- **Webkit**: `/seller/apply` への `page.goto` 中にトップページ (`/`) へのリダイレクトが発生し、ナビゲーションが中断される。

**原因の仮説:**
ミドルウェア (`src/middleware.ts`) またはレイアウト (`src/app/dashboard/seller/layout.tsx`) でのロールチェックが、ブラウザ間のセッション浸透速度の差により、オンボーディング中に誤作動している可能性があります。

---

## 4. 次に取り組むべきステップ (Step-by-Step)

### Step 1: `seller-onboarding.spec.ts` の動作安定化
1. **Webkitのデバッグ**: `npx playwright test tests/e2e/seller-onboarding.spec.ts --project=webkit --headed` を実行。
2. **リダイレクトの特定**: サインイン後の `metadata.role` 反映タイミングを `waitForURL` や `expect` で厳密に制御するようにテストコードを修正。
3. **Firefoxのタイムアウト解消**: サインインプロセスの待機時間を `timeout` 設定で調整するか、ページロードの完了条件を見直す。

### Step 2: 未実装の E2E テストの作成
`tests/e2e/` に以下の仕様に基づくテストを追加してください。
1. **決済異常系 (`payment-error.spec.ts`)**: 
   - 住所未選択での注文防止
   - 在庫切れ商品のカート投入制限
   - ブラウザバック時の二重決済防止
2. **検索・フィルタ (`search-filter.spec.ts`)**:
   - キーワード検索結果の妥当性
   - カテゴリ・価格フィルタの連動
   - ページネーションの動作
3. **モバイルレスポンシブ (`mobile-responsive.spec.ts`)**:
   - iPhone/Android ビューポートでのメニュー・カートの操作感。

### Step 3: Lint エラーの解消
1. `bun run lint` を実行し、現在出ている Tailwind CSS のクラス順序や省略記法の警告を自動修正または手動修正。
2. `src/queries/product.ts` 等で発生している ESLint ルール違反の解消。

---

## 5. 参考リファレンス
- **設定ファイル**: `playwright.config.ts`
- **モック工場**: `src/config/test-fixtures.ts`
- **Authロジック**: `src/middleware.ts`
- **主要UI**: `src/components/dashboard/shared/image-upload.tsx`
