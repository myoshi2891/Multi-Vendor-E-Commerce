# Tech Constraints

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| **Frontend** | Next.js 14 (App Router) + TypeScript strict mode |
| **UI** | Tailwind CSS + shadcn/ui（CSS 変数・baseカラー: slate） |
| **認証** | Clerk（middleware: `src/middleware.ts`） |
| **DB** | PostgreSQL (Neon) + Prisma ORM + Prisma Accelerate |
| **決済** | Stripe / PayPal |
| **画像** | Cloudinary |
| **Webhook** | Svix |
| **状態管理** | Zustand（カートストア） |
| **テスト** | Jest（ユニット）+ Playwright（E2E） |
| **パッケージマネージャー** | Bun |

---

## コーディング規約

| 項目 | 内容 |
|-----|------|
| **TypeScript** | `any` 禁止（`unknown` + 型ガードで代替） |
| **ESLint** | `next/core-web-vitals` + `plugin:tailwindcss/recommended` |
| **エラーハンドリング** | Prisma・Clerk・Stripe/PayPal の外部呼び出しは必ず `try/catch` でラップ |
| **ログ** | `src/` 配下のアプリケーションコードでは `console.log()` 禁止。ただしスタンドアロン CLI（例: `prisma/seed/`）は許容 |
| **コミットメッセージ** | Conventional Commits 形式（例: `feat:` / `fix:` / `chore:`） |

---

## ❌ 禁止事項

> 以下に違反した場合、CI が失敗するか本番データが破損する恐れがあります。

| 禁止操作 | 代替手段 |
|---------|---------|
| `src/` 配下で `new PrismaClient()` を直接呼ぶ | `src/lib/db.ts` のシングルトン経由を使う（`prisma/seed/` とテストは例外） |
| `src/queries/` 以外でサーバーアクションを定義する | 必ず `src/queries/` 配下に配置する |
| UI コンポーネントから `src/queries/` を直接 import する | Server Component 経由でのみ呼び出す |
| `bunx prisma db push` を本番相当環境で使う | 本番・ステージング環境では `bunx prisma migrate deploy` を使う（`bunx prisma migrate dev` はローカル開発専用であり、予期せぬマイグレーション生成の原因になります） |
| `prisma/migrations/` 配下の既存ファイルを編集する | 補正マイグレーションを新規作成する |
| シークレット・API キーを `.env` 以外に書く / コミットする | `.env.local` に記載し `.gitignore` に含める |
| 本番 DB への `DELETE` / `DROP` を人間の確認なしに実行する | `safe-migration` スキルを使い承認を得る |

---

## テスト要件

| 種別 | 配置場所 | 対象 |
|-----|---------|------|
| Jest ユニットテスト | サーバーアクションのテストに限定: `src/queries/*.test.ts`<br>※コンポーネント/ストアのテスト（例: `useCartStore.test.ts`）はソースファイルと同階層（例: `src/cart-store/`）に配置する | 全サーバーアクション |
| Jest シードテスト | `prisma/seed/__tests__/` | 実データ検証・実DB統合テスト用（`src/config/` 非依存）。詳細は `docs/testing/TESTING_DESIGN.md` 参照 |
| Playwright E2E テスト | `tests/e2e/` | Chromium / Firefox / WebKit の3ブラウザ |
| E2E シードデータ | `bun run seed:e2e` で投入 | — |

---

## ビルド・テストコマンド（クイックリファレンス）

```bash
bun run dev             開発サーバー起動
bun run build           本番ビルド
bun run lint            ESLint 実行
bun run test            Jest ユニットテスト
bunx playwright test    Playwright E2E テスト
bun run seed:e2e        E2E テスト用シード（CI/E2E 用）
bun run seed:luxury     データセット生成用シード（ローカル開発・デザイン確認用）
bunx prisma generate    Prisma クライアント再生成
bunx prisma migrate dev    マイグレーション適用（ローカル開発のみ）
bunx prisma migrate deploy マイグレーション適用（本番・ステージング）
```
