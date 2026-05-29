# Tech Constraints

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| **Frontend** | Next.js 16.2.1 (App Router) + TypeScript strict mode |
| **Runtime** | React 19 |
| **UI** | Tailwind CSS + shadcn/ui（CSS 変数・baseカラー: slate） |
| **認証** | Clerk v7（middleware: `src/middleware.ts`） |
| **DB** | PostgreSQL (Neon) + Prisma ORM + Prisma Accelerate |
| **決済** | Stripe / PayPal |
| **画像** | Cloudinary |
| **Webhook** | Svix |
| **状態管理** | Zustand（カートストア） |
| **テスト** | Jest（ユニット）+ Playwright（E2E） |
| **Lint** | ESLint 9（flat config: `eslint.config.mjs`） |
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
| **cookie パース** | 外部 cookie の JSON パースは必ず `parseUserCountryCookie()` を使用すること（`src/lib/utils.ts`）。生の `JSON.parse` + キャストは禁止 |
| **URL パラメータ正規化** | ページ番号など数値パラメータは `Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1` で正規化すること（`Infinity` / `NaN` / 小数を排除） |
| **CSRF** | Next.js 16 Server Actions の Origin/Host 検証と Clerk `SameSite=Lax` セッション Cookie に依拠する。`src/lib/csrf*` 等のトークンモジュールを新設しないこと。例外時は [ADR 001](../../docs/architecture/decisions/001-csrf-policy.md) を Superseded で更新する |
| **認可ガード** | `src/queries/` の Server Action で `if (!user) ... if (role !== "...")` のインライン展開を新規追加しないこと。共通ヘルパー `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner`（`src/lib/auth-guards.ts`）を使用する |
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

### Cookie パース（外部入力の安全なデシリアライズ）

cookie など外部入力の JSON は `parseUserCountryCookie()` で型安全にパースする:

```typescript
import { parseUserCountryCookie } from "@/lib/utils";
import { cookies } from "next/headers";

// Server Component / Route Handler
const cookieStore = await cookies();
const userCountry = parseUserCountryCookie(cookieStore.get("userCountry")?.value);
// → Country 型 (name, code, city, region) または DEFAULT_COUNTRY にフォールバック
```

**利点**:
- `isCountry` 型ガードで全フィールドを検証（name / code / city / region）
- パース失敗・不正データは `DEFAULT_COUNTRY`（US）にフォールバック
- 生の `JSON.parse as Country` キャストを排除

**実装例**: `src/lib/utils.ts` の `parseUserCountryCookie` / `isCountry`

### useEffect キャンセルフラグ（非同期レースコンディション防止）

`useEffect` 内で非同期処理を行う場合は、古いレスポンスで新しい状態を上書きしないよう `cancelled` フラグを用いる:

```typescript
useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
        try {
            const result = await someAsyncCall();
            if (!cancelled) {   // アンマウント後 or 再実行後は更新しない
                setState(result);
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("[Module:fetch] Error:", error.message, error.stack);
            } else {
                console.error("[Module:fetch] Unknown error:", error);
            }
            if (!cancelled) setData([]);
        } finally {
            if (!cancelled) setLoading(false);
        }
    };

    fetchData();
    return () => { cancelled = true; };  // クリーンアップ
}, [dependency]);
```

**実装例**: `src/app/(store)/profile/history/[page]/page.tsx`

### サードパーティ型の module augmentation

React 19 の `useRef<T>(null)` は `RefObject<T | null>` を返すが、古いライブラリは `RefObject<T>` を期待する場合がある。型定義ファイルで拡張する:

```typescript
// src/types/use-onclickoutside.d.ts
declare module "use-onclickoutside" {
    import { RefObject } from "react";
    type PossibleEvent = MouseEvent | TouchEvent;
    type Handler = (event: PossibleEvent) => void;
    export default function useOnClickOutside(
        ref: RefObject<HTMLElement | null>,  // | null を許容
        handler: Handler | null,
        options?: { document?: Document }
    ): void;
}
```

**実装例**: `src/types/use-onclickoutside.d.ts`

### Clerk v7 非同期 API（Next.js 16 対応）

Next.js 16 の async request APIs に合わせ、Clerk v7 の API もすべて非同期になった:

```typescript
// middleware.ts — clerkMiddleware ハンドラーは async
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
export default clerkMiddleware(async (auth, req) => {
    if (protectedRoutes(req)) await auth.protect();  // auth は直接プロパティ（関数呼び出し不要）
    // ...
});

// Server Component / Server Action
import { auth, currentUser } from "@clerk/nextjs/server";

const { userId } = await auth();           // ← await 必須（v6 では同期）
const user = await currentUser();          // ← await 必須

// clerkClient は Promise を返す
import { clerkClient } from "@clerk/nextjs/server";
const client = await clerkClient();
await client.users.updateUserMetadata(userId, { ... });
```

**破壊的変更（v6 → v7）**:
- `auth()` → `await auth()`
- `currentUser()` → `await currentUser()`
- `clerkClient.users.*` → `(await clerkClient()).users.*`
- `authMiddleware` → `clerkMiddleware`

**実装例**: `src/middleware.ts`、`src/queries/` 配下の全 Server Action

### DB 依存ページの動的レンダリング規約（Next.js 16）

`src/queries/*` 経由で Prisma を呼ぶ `page.tsx` は、**原則として** `export const dynamic = 'force-dynamic';` を import 群の直後に宣言する:

```typescript
// 例: src/app/dashboard/admin/categories/page.tsx
import { getAllCategories } from "@/queries/category";
// ...他 import...

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
    const categories = await getAllCategories();
    // ...
}
```

**理由**:
- Next.js 16 のデフォルトはビルド時に Server Component の静的化を試みる。`auth()` / `cookies()` / `headers()` 等の動的シグナルが無いと Prisma クエリがビルドホストから実行され、DB 到達性に依存する。
- CI（`.github/workflows/ci.yml`）は `DATABASE_URL=postgresql://stub:stub@localhost:5432/stub` で `next build` を走らせるため、明示宣言が無いと CI build ジョブが脆くなる。
- `auth()` 経由で間接的に動的化される場合でも、Next.js が `Dynamic server usage` を内部 throw → `try/catch` で `console.error` に漏出するログノイズを排除できる。

**トレードオフ**:
- ストアフロント公開ページ（home / browse / product 詳細 / store 詳細）の SSG/ISR を放棄。SEO 観点で SSR にコストがかかるが、CI 安定性を優先。

### Context Provider setter の同期化（React 19 strict act mode 対応）

Context Provider が公開する setter（例: `ModalProvider.setOpen`）で、**consumer が戻り値を await しない設計** の場合は **同期関数として実装**すること。`async` 関数として定義すると `onClick={() => setOpen(...)}` のような呼び出しが常に floating promise を生成し、React 19 strict act mode のテスト環境で cleanup 段階の「unflushed effect」検出によりフレークの原因となる。

**❌ NG パターン**:

```ts
// floating promise が onClick から漏れる
const setOpen = async (modal, fetchData) => {
    setShowingModal(modal);
    setIsOpen(true);
    if (fetchData) {
        const data = await fetchData();
        setData(data);
    }
};
```

**✅ OK パターン**: 同期関数化 + 非同期 work は fire-and-forget IIFE

```ts
const setOpen = (modal, fetchData): void => {
    if (!modal) return;
    setShowingModal(modal);
    setIsOpen(true);
    if (!fetchData) return;

    void (async () => {
        try {
            const data = await fetchData();
            setData(prev => ({ ...prev, ...data }));
        } catch (error) {
            if (error instanceof Error) {
                console.error("Failed to fetch X:", error.message, error.stack);
            }
        }
    })();
};
```

**判断基準**:

1. consumer が `await setter(...)` していないなら同期関数で実装
2. 公開型は `Promise<void>` ではなく `void` を返す（型の正直化）
3. 非同期 work が必要な分岐だけ IIFE で起動

**実装例**: [src/providers/modal-provider.tsx](../../src/providers/modal-provider.tsx) ([ADR-003](../../docs/architecture/decisions/003-modal-setopen-sync-for-react19.md))

---

### 意図的に未対応の Next.js 16 警告

| 警告 | 対応方針 | 理由 |
|------|---------|------|
| `The "middleware" file convention is deprecated. Please use "proxy" instead.` | 対応しない | Clerk v7.0.7 の `clerkMiddleware` は `src/middleware.ts` 配置前提。`@clerk/nextjs` の `proxy.d.ts` は frontend API proxy 用途であり middleware 代替ではない。Clerk が `proxy.ts` を正式サポートするまで rename しない |
| `AVIF image not supported (Turbopack)` | 対応しない | ローカル `import` の最適化スキップのみ。Next.js Image のリモート画像最適化経路には影響なく、production の画像配信品質は変化しない。Turbopack の AVIF 対応追加を待つ |

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

make setup              Docker フルスタック開発環境（app + PostgreSQL）を初期化
make help               Docker/Make コマンド一覧（詳細: docs/development/docker-dev.md）
```
