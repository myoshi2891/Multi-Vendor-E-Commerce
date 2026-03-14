---
name: server-action-scaffold
description: >
  Generates consistent server action templates in src/queries/ by learning existing
  patterns. Produces implementation file, Zod schema addition, and unit tests (AAA pattern)
  in a single scaffold. Only triggered when a new server action is explicitly requested.
  Triggered by: "新しいサーバーアクション", "サーバーアクション追加", "server action作成",
  "APIエンドポイント追加", "queries追加", "new server action", "add server action",
  "scaffold action", "create query".
invocation: automatic
allowed-tools: [Read, Grep]
---

# Server Action Scaffold スキル

> **[SKILL LOADED]** `server-action-scaffold` スキルが読み込まれました ✅
> *(デバッグ確認後はこの行を削除してください)*

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
| **認証** | `currentUser()` の呼び出し位置と未認証時のレスポンス |
| **ロールチェック** | `db.user.findUnique` で `role` を確認するパターン |
| **バリデーション** | `XXXSchema.parse(data)` の使用タイミング |
| **DB 操作** | `create` / `findMany` / `updateMany` / `deleteMany` の使用方法 |
| **レスポンス形式** | `{ success: true, data }` / `{ success: false, error }` |
| **エラーハンドリング** | `try/catch` + `console.error()` のパターン |

---

### Step 2｜Zod スキーマを確認する

```
Read: src/lib/schemas.ts
```

確認ポイント：

- 既存スキーマの命名規則（`XXXSchema` 形式）
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

```typescript
"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { XXXSchema } from "@/lib/schemas";
import { z } from "zod";

/** [機能の説明] */
export async function createXXX(data: z.infer<typeof XXXSchema>) {
  try {
    const user = await currentUser();
    if (!user) return { success: false, error: "認証が必要です" };

    const validated = XXXSchema.parse(data);

    const result = await db.xxx.create({
      data: { ...validated, userId: user.id },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("createXXX error:", error);
    return { success: false, error: "作成に失敗しました" };
  }
}

/** [一覧取得の説明] */
export async function getXXXList() {
  try {
    const user = await currentUser();
    if (!user) return { success: false, error: "認証が必要です" };

    const results = await db.xxx.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("getXXXList error:", error);
    return { success: false, error: "取得に失敗しました" };
  }
}

/** [更新の説明] */
export async function updateXXX(id: string, data: z.infer<typeof XXXSchema>) {
  try {
    const user = await currentUser();
    if (!user) return { success: false, error: "認証が必要です" };

    const validated = XXXSchema.parse(data);

    // userId を where に含めることで権限チェックをアトミックに実施
    const result = await db.xxx.updateMany({
      where: { id, userId: user.id },
      data: validated,
    });

    if (result.count === 0) return { success: false, error: "権限がありません" };

    return { success: true, data: result };
  } catch (error) {
    console.error("updateXXX error:", error);
    return { success: false, error: "更新に失敗しました" };
  }
}

/** [削除の説明] */
export async function deleteXXX(id: string) {
  try {
    const user = await currentUser();
    if (!user) return { success: false, error: "認証が必要です" };

    // userId を where に含めることで権限チェックをアトミックに実施
    const result = await db.xxx.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) return { success: false, error: "権限がありません" };

    return { success: true };
  } catch (error) {
    console.error("deleteXXX error:", error);
    return { success: false, error: "削除に失敗しました" };
  }
}
```

#### B. Zod スキーマ（`src/lib/schemas.ts` への追加案）

```typescript
export const XXXSchema = z.object({
  field1: z.string().min(2, "2文字以上必要です"),
  field2: z.number().positive("正の数が必要です"),
  field3: z.string().email("有効なメールアドレスを入力してください").optional(),
});

export type XXXInput = z.infer<typeof XXXSchema>;
```

#### C. ユニットテスト（`src/queries/XXX.test.ts`）

AAA パターン（Arrange / Act / Assert）で全 CRUD + 権限チェックを網羅する：

```typescript
import { createXXX, getXXXList, updateXXX, deleteXXX } from "./XXX";
import { mockAuth, mockPrisma } from "@/config/test-helpers";
import { createTestUser, createTestXXX } from "@/config/test-fixtures";

jest.mock("@clerk/nextjs/server");
jest.mock("@/lib/db");

describe("XXX サーバーアクション", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("createXXX", () => {
    it("正常ケース: データを作成できる", async () => {
      // Arrange
      const testUser = createTestUser({ role: "USER" });
      mockAuth({ userId: testUser.clerkId });
      const input = { field1: "テスト値", field2: 100 };
      const expected = { id: "xxx-123", ...input, userId: testUser.clerkId };
      mockPrisma.xxx.create.mockResolvedValue(expected);

      // Act
      const result = await createXXX(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expected);
      expect(mockPrisma.xxx.create).toHaveBeenCalledWith({
        data: { ...input, userId: testUser.clerkId },
      });
    });

    it("異常ケース: 未認証の場合エラーを返す", async () => {
      mockAuth(null);
      const result = await createXXX({ field1: "テスト", field2: 100 });
      expect(result.success).toBe(false);
      expect(result.error).toBe("認証が必要です");
      expect(mockPrisma.xxx.create).not.toHaveBeenCalled();
    });

    it("異常ケース: バリデーションエラーの場合エラーを返す", async () => {
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId });
      const result = await createXXX({ field1: "a", field2: 100 }); // 2文字未満
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getXXXList", () => {
    it("正常ケース: ユーザーの一覧を取得できる", async () => {
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId });
      const testData = [
        createTestXXX({ userId: testUser.clerkId }),
        createTestXXX({ userId: testUser.clerkId }),
      ];
      mockPrisma.xxx.findMany.mockResolvedValue(testData);

      const result = await getXXXList();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
      expect(mockPrisma.xxx.findMany).toHaveBeenCalledWith({
        where: { userId: testUser.clerkId },
        orderBy: { createdAt: "desc" },
      });
    });

    it("異常ケース: 未認証の場合エラーを返す", async () => {
      mockAuth(null);
      const result = await getXXXList();
      expect(result.success).toBe(false);
      expect(result.error).toBe("認証が必要です");
    });
  });

  describe("updateXXX", () => {
    it("正常ケース: 自分のデータを更新できる", async () => {
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId });
      const existing = createTestXXX({ userId: testUser.clerkId });
      mockPrisma.xxx.updateMany.mockResolvedValue({ count: 1 });

      const result = await updateXXX(existing.id, { field1: "更新後", field2: 200 });

      expect(result.success).toBe(true);
      expect(mockPrisma.xxx.updateMany).toHaveBeenCalledWith({
        where: { id: existing.id, userId: testUser.clerkId },
        data: { field1: "更新後", field2: 200 },
      });
    });

    it("異常ケース: 他人のデータは更新できない", async () => {
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId });
      const existing = createTestXXX({ userId: "other-user-id" });
      mockPrisma.xxx.updateMany.mockResolvedValue({ count: 0 });

      const result = await updateXXX(existing.id, { field1: "更新後", field2: 200 });

      expect(result.success).toBe(false);
      expect(result.error).toBe("権限がありません");
    });
  });

  describe("deleteXXX", () => {
    it("正常ケース: 自分のデータを削除できる", async () => {
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId });
      const existing = createTestXXX({ userId: testUser.clerkId });
      mockPrisma.xxx.deleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteXXX(existing.id);

      expect(result.success).toBe(true);
      expect(mockPrisma.xxx.deleteMany).toHaveBeenCalledWith({
        where: { id: existing.id, userId: testUser.clerkId },
      });
    });

    it("異常ケース: 他人のデータは削除できない", async () => {
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId });
      const existing = createTestXXX({ userId: "other-user-id" });
      mockPrisma.xxx.deleteMany.mockResolvedValue({ count: 0 });

      const result = await deleteXXX(existing.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe("権限がありません");
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
2. `src/lib/schemas.ts` への追加 — XXXSchema / XXXInput
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

### ✅ 必須

- すべてのファイル先頭に `"use server"` を記述する
- すべてのサーバーアクションで `currentUser()` による認証チェックを行う
- すべてのサーバーアクションを `try/catch` で囲み `console.error()` でログ出力する
- 入力データは `XXXSchema.parse(data)` でバリデーションする
- レスポンスは `{ success: true, data }` / `{ success: false, error }` に統一する
- 更新・削除は `updateMany` / `deleteMany` + `where: { id, userId }` で権限チェックをアトミックに行う
- テストは AAA パターン（Arrange / Act / Assert）で記述する

### 💡 推奨

- `src/config/test-fixtures.ts` のファクトリ関数を積極的に活用する
- 新しいドメインには対応するファクトリ関数を `test-fixtures.ts` に追加する
- 権限チェックのテストケースは「正常・未認証・他人のデータ」の3軸で網羅する

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
