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
- [x] **型安全性の向上**: UIコンポーネントからの `any` 削除。
- [x] **Middlewareテストの修正**: Clerk と Next.js の型不整合を解消。
- [x] **Stripeテストのリファクタリング**: `jest.mocked` を使用した安全なモックへの移行。
- [x] **ImageUploadの修正**: Cloudinary の型定義適用と `data-testid` の統一。
- [x] **E2Eテスト (Phase 3)**: セラーオンボーディング（ブラウザ間の挙動安定化対応完了）。
- [x] **新規 E2Eテスト作成**: `payment-error.spec.ts`, `search-filter.spec.ts`, `mobile-responsive.spec.ts` の追加と不具合修正。
- [x] **Lint警告解消**: `react-hooks/exhaustive-deps` 警告と Tailwind CSS のカスタムクラス警告 (`tailwindcss/no-custom-classname`) をすべて修正し、`bun run lint` のエラー/警告をゼロに。
- [x] **コードレビュー指摘事項の反映**: `useEffect` 内の非同期処理のエラーハンドリング・クリーンアップ追加、UIコンポーネントの Tailwind クラス整理、テストコードの型安全性の向上など。

### 進行中のタスク
- [ ] **E2Eテストの CI/CD 連携と追加安定化**: 必要に応じて実装したテストコードを実際のCIやローカルで全ブラウザパスするか確認する。

---

## 3. 次に取り組むべきステップ (Step-by-Step)

### Step 1: E2E テストのフルラン確認
- 作成した E2E テスト (`payment-error.spec.ts`, `search-filter.spec.ts`, `mobile-responsive.spec.ts`, `purchase-flow.spec.ts` 等) を `bunx playwright test` で実行し、モックや初期データの整合性がとれているか、また安定してパスするか確認してください。

### Step 2: 仕様書に基づいた機能・非機能要件の最終確認
- `specs/multi-vendor-ecommerce/` 以下の各ドキュメントを参照し、現在の実装が要件（特にデータモデルの制約や決済フロー）を完全に満たしているか最終チェックを行います。
- 不足しているエラーケースのテスト（境界値テスト、異常系テスト）を必要に応じて追加します。

---

## 4. 参考リファレンス
- **仕様書**: `specs/multi-vendor-ecommerce/` — 参照必須。実装の前後および実装中に必ず確認してください。
- **設定ファイル**: `playwright.config.ts`, `tailwind.config.ts`
- **E2E シード定義**: `tests/e2e/seed/constants.ts`
