---
name: server-action-scaffold
description: >
  Generates consistent server action templates in src/queries/ by learning existing
  patterns. Produces implementation file, Zod schema addition, and unit tests (AAA pattern)
  in a single scaffold. Only triggered when a new server action is explicitly requested.
  Triggered by: "新しいサーバーアクション", "サーバーアクション追加", "server action作成",
  "新しいserver actionを追加", "add server action (query)", "new server action", "add server action",
  "scaffold action", "create query".
invocation: automatic
allowed-tools: [Read, Grep]
---

# Server Action Scaffold スキル

## 目的

`src/queries/` に新しいサーバーアクションを追加する際、既存の実装パターンを学習したうえで一貫性のあるテンプレート（実装・スキーマ・テスト）を生成するスキル。

---

## 実行手順（この順番を厳守すること）

### Step 1｜既存パターンを学習する

以下のファイルを読み込み、プロジェクト固有の実装パターンを抽出する：

```
Read: src/queries/product.ts
Read: src/queries/store.ts
Read: src/queries/user.ts
```

抽出するパターン：

| パターン | 内容 |
|---------|------|
| **ファイル構造** | `"use server"` ディレクティブ・インポート順 |
| **認証・認可** | `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner` の使い分け (`src/lib/auth-guards.ts`)。**インライン `currentUser()` + `if (!user) ...` の新規追加は禁止** ([tech.md](../../steering/tech.md) "認可ガード" 項) |
| **バリデーション** | `XXXFormSchema.parse(data)` の使用タイミング |
| **DB 操作** | `requireStoreOwner` 等で先取り認可 → `update` / `delete` / `findUnique` |
| **レスポンス形式** | **`throw new Error("...")`** で失敗系を表現（実コード `src/queries/*` は `{success, error}` ラッパーを使わない） |
| **エラーハンドリング** | `try/catch` + 構造化ログ `console.error("[Module:Function] ...", { error, stack })` |
| **IDOR テスト 3 階層** | (a) スロー検証 + (b) `where: { url, userId }` 構造検証 + (c) ガード失敗時の副作用なし検証 ([SECURITY_GAP_REPORT §5.2](../../../docs/testing/SECURITY_GAP_REPORT.md)) |

---

### Step 2｜Zod スキーマを確認する

```
Read: src/lib/schemas.ts
```

確認ポイント：

- 既存スキーマの命名規則（`XXXFormSchema` 形式）
- フィールドバリデーションのパターン（`min` / `max` / `email` / `url` 等）
- カスタムバリデーションの実装方法

---

### Step 3｜テストファクトリを確認する

```
Read: src/config/test-fixtures.ts
Read: src/config/test-helpers.ts
Read: src/config/test-scenarios.ts
```

利用可能なファクトリ関数をリストアップし、テスト生成時に参照する。

---

### Step 4｜3ファイルのテンプレートを生成する

#### A. サーバーアクション実装（`src/queries/XXX.ts`）

> **認可ガードの選択指針** ([src/lib/auth-guards.ts](../../../src/lib/auth-guards.ts)):
> - `requireUser()` — 認証必須 (USER / SELLER / ADMIN 問わず)。**`User` を返す**（分割代入不可。`const user = await requireUser()` で受け取る）
> - `requireAdmin()` — `role === "ADMIN"` のみ。グローバルリソース管理 (category / offer-tag 等)。**`User` を返す**
> - `requireSeller()` — `role === "SELLER"` のみ。ストア所有権を URL 経由で問わない場合 (例: `deleteProduct` は `productId` 起点で別途インライン比較)。**`User` を返す**
> - `requireStoreOwner(storeUrl)` — `role === "SELLER"` ＋ `where: { url, userId }` 複合検索で **IDOR 防御を集約**。`{ user, store }` を返し、後段の `findUnique` 重複を避ける

```typescript
"use server";

import { db } from "@/lib/db";
import {
  requireUser,
  requireAdmin,
  requireSeller,
  requireStoreOwner,
} from "@/lib/auth-guards";
import { XXXFormSchema } from "@/lib/schemas";
import { z } from "zod";

/**
 * [機能の説明]
 * @throws "Unauthenticated." / "Only sellers can perform this action." /
 *         "Forbidden: store not owned by current user."
 */
export async function upsertXXX(
  data: z.infer<typeof XXXFormSchema>,
  storeUrl: string
) {
  try {
    // 認証 + SELLER + 店舗所有権を集約検証 (auth-guards / IDOR 防御)
    const { store } = await requireStoreOwner(storeUrl);

    // Zod バリデーション
    const validated = XXXFormSchema.parse(data);

    return await db.xxx.upsert({
      where: { id: validated.id },
      create: { ...validated, storeId: store.id },
      update: validated,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[XXX:upsertXXX] Error", {
        error: error.message,
        stack: error.stack,
      });
    } else {
      console.error("[XXX:upsertXXX] Unknown error", { error });
    }
    throw error;
  }
}

/** ストア配下の XXX 一覧を取得する (SELLER 専用) */
export async function getStoreXXXList(storeUrl: string) {
  try {
    const { store } = await requireStoreOwner(storeUrl);

    return await db.xxx.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[XXX:getStoreXXXList] Error", {
        error: error.message,
        stack: error.stack,
      });
    }
    throw error;
  }
}

/** XXX を削除する (SELLER + 所有権必須) */
export async function deleteXXX(xxxId: string, storeUrl: string) {
  try {
    await requireStoreOwner(storeUrl);
    if (!xxxId) throw new Error("Please provide XXX ID.");

    return await db.xxx.delete({ where: { id: xxxId } });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[XXX:deleteXXX] Error", {
        error: error.message,
        stack: error.stack,
      });
    }
    throw error;
  }
}

/** ADMIN 専用のグローバルリソース操作 (例: category / offer-tag) */
export async function upsertGlobalXXX(data: z.infer<typeof XXXFormSchema>) {
  try {
    await requireAdmin();
    const validated = XXXFormSchema.parse(data);
    return await db.xxx.upsert({
      where: { id: validated.id },
      create: validated,
      update: validated,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[XXX:upsertGlobalXXX] Error", {
        error: error.message,
        stack: error.stack,
      });
    }
    throw error;
  }
}
```

> **注意 (deleteProduct パターン)**: 削除対象が **store URL ではなく ID 起点** (例: `productId`) の場合は `requireSeller()` + 自前の `findUnique({ include: { store: { select: { userId: true } } } })` + インライン `product.store.userId !== user.id` チェックを使う。`src/queries/product.ts::deleteProduct` を参照。

#### B. Zod スキーマ（`src/lib/schemas.ts` への追加案）

```typescript
export const XXXFormSchema = z.object({
  field1: z.string().min(2, "2文字以上必要です"),
  field2: z.number().positive("正の数が必要です"),
  field3: z.string().email("有効なメールアドレスを入力してください").optional(),
});

export type XXXInput = z.infer<typeof XXXFormSchema>;
```

#### C. ユニットテスト（`src/queries/XXX.test.ts`）

AAA パターンに加え、**IDOR テスト 3 階層** (a)(b)(c) を必ず含める ([SECURITY_GAP_REPORT §5.2](../../../docs/testing/SECURITY_GAP_REPORT.md)):

| 階層 | 検証内容 | 例 |
|------|---------|-----|
| (a) | スロー検証 | `expect(...).rejects.toThrow("Forbidden: store not owned by current user.")` |
| (b) | where 句の構造検証 | `expect(mockDb.store.findUnique).toHaveBeenCalledWith({ where: { url, userId } })` |
| (c) | ガード失敗時の副作用なし検証 | `expect(mockDb.xxx.upsert).not.toHaveBeenCalled()` |

```typescript
import { upsertXXX, getStoreXXXList, deleteXXX } from "./XXX";
import { currentUser } from "@clerk/nextjs/server";
import { TEST_CONFIG } from "@/config/test-config";
import { createMockStore, createMockXXX } from "@/config/test-fixtures";

jest.mock("@clerk/nextjs/server", () => ({
  currentUser: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: {
    store: { findUnique: jest.fn() },
    xxx: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockDb = require("@/lib/db").db;

describe("upsertXXX", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("認証・権限エラー", () => {
    it("未認証ユーザーの場合 'Unauthenticated.' をスローする", async () => {
      (currentUser as jest.Mock).mockResolvedValue(null);
      await expect(
        upsertXXX(createMockXXX() as never, TEST_CONFIG.TEST_STORE_URL)
      ).rejects.toThrow("Unauthenticated.");
    });

    it("SELLER 以外の場合 'Only sellers can perform this action.' をスローする", async () => {
      (currentUser as jest.Mock).mockResolvedValue({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role: "USER" },
      });
      await expect(
        upsertXXX(createMockXXX() as never, TEST_CONFIG.TEST_STORE_URL)
      ).rejects.toThrow("Only sellers can perform this action.");
    });
  });

  describe("IDOR防止 (3 階層検証)", () => {
    beforeEach(() => {
      (currentUser as jest.Mock).mockResolvedValue({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role: "SELLER" },
      });
    });

    it("クロステナント時に Forbidden をスローし、where 構造 + 副作用なしを満たす", async () => {
      // requireStoreOwner は where: { url, userId } の複合検索を発行する。
      // 他人の店舗 URL を渡すと DB レベルで null が返り、ガードが throw する。
      mockDb.store.findUnique.mockResolvedValue(null);

      // (a) スロー検証
      await expect(
        upsertXXX(createMockXXX() as never, "other-store")
      ).rejects.toThrow("Forbidden: store not owned by current user.");

      // (b) where 構造検証 — userId 条件が外れた場合に検知
      expect(mockDb.store.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { url: "other-store", userId: TEST_CONFIG.DEFAULT_USER_ID },
        })
      );

      // (c) 副作用なし検証 — ガード失敗時に下流 I/O が走らない
      expect(mockDb.xxx.upsert).not.toHaveBeenCalled();
    });
  });

  describe("正常系", () => {
    beforeEach(() => {
      (currentUser as jest.Mock).mockResolvedValue({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role: "SELLER" },
      });
      mockDb.store.findUnique.mockResolvedValue(createMockStore());
    });

    it("XXX を upsert する", async () => {
      const xxx = createMockXXX();
      mockDb.xxx.upsert.mockResolvedValue(xxx);
      const result = await upsertXXX(xxx as never, TEST_CONFIG.TEST_STORE_URL);
      expect(result).toEqual(xxx);
    });
  });
});
```

---

### Step 5｜生成結果のサマリーを表示する

```markdown
## Server Action Scaffold 生成結果

### 生成ファイル
1. `src/queries/XXX.ts` — createXXX / getXXXList / updateXXX / deleteXXX
2. `src/lib/schemas.ts` への追加 — XXXFormSchema / XXXInput
3. `src/queries/XXX.test.ts` — CRUD × 正常・異常・権限チェック

### 次のアクション
- [ ] 生成コードを確認・カスタマイズ
- [ ] 追加バリデーションの実装
- [ ] テスト実行: `bun run test -- --testPathPattern=src/queries/XXX.test.ts`
- [ ] 仕様書更新: `specs/multi-vendor-ecommerce/04-interfaces.md`
- [ ] コミット: `git add src/queries/XXX.* src/lib/schemas.ts && git commit -m "feat: XXX サーバーアクションを追加"`
```

---

## 重要ルール

### ❌ 絶対禁止

- `any` 型の使用（`unknown` + 型ガードで代替する）
- `new PrismaClient()` の直接使用（必ず `import { db } from "@/lib/db"` を使う）
- `src/queries/` 以外でのサーバーアクション定義
- Client Component から `src/queries/` を直接インポート
- **`if (!user) ...` / `if (role !== "...") ...` のインライン展開を新規追加する** — 必ず `src/lib/auth-guards.ts` のヘルパーを使う ([tech.md](../../steering/tech.md) "認可ガード" 項)
- **`{ success: false, error }` ラッパー型の新規導入** — 実コード `src/queries/*` は throw ベース。ラッパー型は UI 側の責務

### ✅ 必須

- すべてのファイル先頭に `"use server"` を記述する
- 認証・認可は `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner` のいずれか 1 つで集約する
- すべてのサーバーアクションを `try/catch` で囲み、構造化ログ `console.error("[Module:Function] ...", { error, stack })` を発行する
- 入力データは `XXXFormSchema.parse(data)` でバリデーションする
- 失敗系は `throw new Error("...")` で表現する（ラッパー型を使わない）
- 店舗所有権が必要なアクションは **必ず `requireStoreOwner(storeUrl)` を使う**。返り値の `{ user, store }` を再利用し、後段で `findUnique({ where: { url, userId } })` を重複呼び出ししない
- テストは AAA パターン + **IDOR 3 階層 (a)(b)(c)** で記述する

### 💡 推奨

- `src/config/test-fixtures.ts` のファクトリ関数を積極的に活用する
- 新しいドメインには対応するファクトリ関数を `test-fixtures.ts` に追加する
- 権限テストは「未認証 / ロール不一致 / IDOR 3 階層 (a)(b)(c) / 正常系」の最低 5 つの describe を用意する

---

## 参考: 主要ファイルパス

```
# 参考実装
src/queries/product.ts      商品管理（参考実装）
src/queries/store.ts        ストア管理（参考実装）
src/queries/user.ts         ユーザー管理（参考実装）

# スキーマ・型定義
src/lib/schemas.ts          Zod スキーマ定義
src/lib/types.ts            TypeScript 型定義
src/lib/db.ts               Prisma シングルトン

# テスト共通設定
src/config/test-fixtures.ts テストファクトリ
src/config/test-helpers.ts  テストヘルパー
src/config/test-scenarios.ts テストシナリオ
src/config/test-config.ts   テスト定数
```
