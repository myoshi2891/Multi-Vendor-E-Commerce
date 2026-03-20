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

## 初期セットアップ (Initial Setup)
プロジェクトを新規にセットアップする際は以下の手順に従ってください。
1. 必要な環境変数の設定 (`.env` に以下の値を設定します)
   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
2. 依存関係のインストール: `bun install`
3. DBのマイグレーションとシードの実行:
   - `bunx prisma migrate dev`
   - `bunx prisma db seed` (E2Eテスト用のデータセットアップを含みます)
4. 開発サーバーの起動: `bun run dev`
5. E2Eテストの実行: `bunx playwright test`

## 2. 現在の進捗状況
フェーズ3（E2Eテストの実装）およびコードレビュー後のリファクタリングを実施中です。

### 完了したタスク
- [x] **Prismaクエリのエラーハンドリング**: `getAllCountries` 等の関数化と try-catch 実装。
- [x] **型安全性の向上**: UIコンポーネント (size.selector, quantity-selector等) からの `any` 削除。
- [x] **Middlewareテストの修正**: Clerk と Next.js の型不整合を解消。
- [x] **Stripeテストのリファクタリング**: `jest.mocked` を使用した安全なモックへの移行。
- [x] **ImageUploadの修正**: Cloudinary の型定義適用と `data-testid` の統一 (`n-mock-input-*`)。
- [x] **E2Eテスト (Phase 3)**: セラーオンボーディング（ブラウザ間の挙動安定化対応完了）。
- [x] **新規 E2Eテスト作成**: `payment-error.spec.ts`, `search-filter.spec.ts`, `mobile-responsive.spec.ts` の追加。
- [x] **Lint警告解消**: `src/queries/product.ts` の `@typescript-eslint/no-explicit-any` 解消、React Hooks (rules-of-hooks) のエラー解消、大部分の Tailwind CSS `classnames-order` の自動修正。

### 進行中のタスク
- [ ] **E2Eテストの CI/CD 連携と追加安定化**: 必要に応じて実装したテストコードを実際のCIやローカルで全ブラウザパスするか確認する。
- [ ] **残存 Lint Warning の解消 (exhaustive-deps)**: `useEffect` の依存配列に関する Warning（`react-hooks/exhaustive-deps`）が多数残っています。これらを手動で確認し安全に解消するか、必要なものは `eslint-disable-next-line` で除外する対応が必要です。

---

## 3. 次に取り組むべきステップ (Step-by-Step)

### Step 1: `react-hooks/exhaustive-deps` の解消
`bun run lint` を実行すると以下の Warning が多数確認できます。これらの依存配列漏れを解消してください。（例: `src/components/dashboard/forms/product-details.tsx`, `src/components/store/product-page/container.tsx` など）
不要な再レンダリングや無限ループを引き起こさないよう、関数を `useCallback` でラップする、あるいは本当に依存として不要な場合は適切にコメントで無視する等の対応が必要です。

### Step 2: カスタムクラスの Tailwind 警告解消
`bun run lint` にて、Tailwind CSS プラグインから「Classname 'xxx' is not a Tailwind CSS class!」という警告が出ています。（例: `scrollbar-track-gray-100`, `fi`, `animate-caret-blink` など）
- これらがプロジェクト独自のカスタムクラスである場合、Tailwind の設定ファイル (`tailwind.config.ts` や `globals.css`) で定義されているか確認し、プラグインの警告を除外するか設定を修正してください。

### Step 3: E2E テストのフルラン確認
- 作成した E2E テスト (`payment-error.spec.ts`, `search-filter.spec.ts`, `mobile-responsive.spec.ts`) を `bunx playwright test` で実行し、モックや初期データの整合性がとれているか、また安定してパスするか確認してください。

---

## 4. 参考リファレンス
- **仕様書**: `specs/multi-vendor-ecommerce/` — 参照必須。実装の前後および実装中に必ず確認してください。
- **設定ファイル**: `playwright.config.ts`, `tailwind.config.ts`
- **E2E シード定義**: `tests/e2e/seed/constants.ts`
