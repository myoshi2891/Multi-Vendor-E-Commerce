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
| **金額・数値精度** | `Float` 禁止。金額フィールドは `Decimal(12,2)` を必須とし、演算は必ず `Prisma.Decimal` メソッド（`.add()`, `.mul()`, `.sub()` 等）で行うこと |
| **エラーハンドリング** | 外部呼び出し（Prisma, Clerk, Stripe/PayPal）は必ず `try/catch` でラップし、`instanceof Error` による型ガードを行う |
| **構造化ログ** | `src/queries/` の `console.error` は `[Module:Function] Error message`, `{ error: message, stack: error.stack }` の形式で構造化すること |
| **アトミック操作** | 注文処理や在庫減算など、複数のテーブルを更新する際は `db.$transaction` によるアトミック化を必須とする |
| **Docstrings** | シーダー、ヘルパー、複雑なロジックには JSDoc 形式の Docstrings を記述し、AI エージェントの理解を助けること |
| **ログ禁止** | `src/` 配下のアプリケーションコードでは `console.log()` 禁止。ただし CLI（`prisma/seed/`）は許容 |
| **配送料計算** | すべての配送料計算は `src/lib/shipping-utils.ts` の `computeShippingTotal` を使用すること（計算ロジックの一元管理） |
| **リエントランシーガード** | 非同期操作での多重実行防止には `useRef` によるフラグ管理を行う（例: `newsletter.tsx`） |
| **環境変数の数値変換** | 数値型環境変数は `trim()` 後に変換し、空文字列には fallback を適用すること |
| **コミットメッセージ** | Conventional Commits 形式（例: `feat:` / `fix:` / `chore:`） |

---

## 実装パターン例

### 配送料計算の中央集約

すべての配送料計算は `src/lib/shipping-utils.ts` の `computeShippingTotal` を使用します:

```typescript
import { computeShippingTotal } from "@/lib/shipping-utils";
import { ShippingFeeMethod } from "@prisma/client";

const total = computeShippingTotal(
  method,        // ShippingFeeMethod: "ITEM" | "WEIGHT" | "FIXED"
  fee,           // 基本配送料
  extraFee,      // 追加配送料（ITEM 方式）
  weight,        // 商品重量（WEIGHT 方式）
  quantity       // 商品数量
);
```

**利点**:
- 計算ロジックの一元管理
- 浮動小数点誤差の統一的な補正（`Math.round((result + Number.EPSILON) * 100) / 100`）
- テスト容易性の向上

### リエントランシーガード

非同期操作での多重実行を防ぐパターン:

```typescript
const isSubmittingRef = useRef(false);

const handleSubmit = async () => {
  if (isSubmittingRef.current) return;  // 早期リターン

  isSubmittingRef.current = true;
  try {
    await performAsyncOperation();
  } finally {
    isSubmittingRef.current = false;   // 必ず解放
  }
};
```

**実装例**: `src/components/store/layout/footer/newsletter.tsx`

### 環境変数の数値変換

空文字列や空白を適切に処理する:

```typescript
const envValue = process.env.MY_NUMBER?.trim();
const myNumber = envValue ? Number(envValue) : defaultValue;

if (!Number.isFinite(myNumber)) {
  throw new Error(`Invalid MY_NUMBER: ${process.env.MY_NUMBER}`);
}
```

**実装例**: `tests/e2e/purchase-flow.spec.ts` の `E2E_UNIT_PRICE` 処理

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
