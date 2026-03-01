# Tech Constraints

## 技術スタック（必須）
- **Frontend**: Next.js 14 (App Router) + TypeScript strict mode
- **UI**: Tailwind CSS + shadcn/ui (CSS変数・baseカラー: slate)
- **認証**: Clerk（middleware: `src/middleware.ts`）
- **DB**: PostgreSQL (Neon) + Prisma ORM + Prisma Accelerate
- **決済**: Stripe / PayPal
- **画像**: Cloudinary
- **Webhook**: Svix
- **状態管理**: Zustand（カートストア）
- **テスト**: Jest (ユニット) + Playwright (E2E)
- **パッケージマネージャー**: Bun

## コーディング規約
- TypeScript `any` 禁止
- ESLint: `next/core-web-vitals` + `plugin:tailwindcss/recommended`
- 外部呼び出し（Prisma・Clerk・Stripe/PayPal）は `try/catch` でラップ
- console.log() はコードレビュー前に必ず削除
- コメント・コミットメッセージ: Conventional Commits 形式

## 禁止事項
- `new PrismaClient()` を直接呼ぶ（`src/lib/db.ts` のシングルトン経由）
- `src/queries/` 以外でサーバーアクションを定義する
- UIコンポーネントから直接サーバーアクションをimportする
- `bunx prisma db push` を本番相当環境で使う（`migrate dev` を使う）
- `migrations/` 配下の既存ファイルを編集する
- シークレット・APIキーを `.env` 以外に書く、またはコミットする
- 本番DBへの `DELETE`/`DROP` は人間の確認なしに実行しない

## テスト要件
- Jestユニットテスト: `src/queries/*.test.ts` に配置
- Playwright E2Eテスト: `tests/e2e/` に配置（3ブラウザ対象）
- E2Eシードデータは `bun run seed:e2e` で投入

## ビルド・テストコマンド（クイックリファレンス）

```bash
bun run dev          # 開発サーバー
bun run build        # 本番ビルド
bun run lint         # ESLint
bun run test         # Jest ユニットテスト
bunx playwright test # Playwright E2E
bunx prisma generate # Prismaクライアント再生成
bunx prisma migrate dev # マイグレーション適用
```
