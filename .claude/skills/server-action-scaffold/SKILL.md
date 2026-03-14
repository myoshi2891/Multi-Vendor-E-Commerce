---
name: server-action-scaffold
description: >
  サーバーアクションの実装テンプレートを生成する。
  「新しいサーバーアクション」「server action作成」「サーバーアクション追加」
  「APIエンドポイント追加」「queries追加」などのキーワードで使用。
  既存パターンを学習し、一貫性のあるコードを生成。
invocation: automatic
allowed-tools: [Read, Grep]
---

# Server Action Scaffold

## 目的

`src/queries/` に新しいサーバーアクションを実装する際の**一貫性のあるテンプレート**を生成する。

このプロジェクトでは、多数のユニットテストが `src/queries/*.test.ts` に集約されており、サーバーアクションの実装パターンが厳格に定義されています（`"use server"`, Zod schema, try/catch, 認証チェック）。

## トリガー条件

以下の場合に自動的に実行されます：

- ユーザーが「新しいサーバーアクション」「server action作成」と言った場合
- 「サーバーアクション追加」「APIエンドポイント追加」「queries追加」などの表現を使った場合
- 具体的な機能名とともにサーバーアクション実装を依頼された場合

## 実行手順

### 1. 既存パターンの学習

#### A. 典型的なサーバーアクション実装の確認

以下の主要なサーバーアクションファイルを読み込み、実装パターンを抽出：

```typescript
// 必須で読み込むファイル
src/queries/product.ts
src/queries/store.ts
src/queries/user.ts
```

以下のパターンを学習：

1. **ファイル構造**

   ```typescript
   "use server";

   // インポート
   import { db } from "@/lib/db";
   import { currentUser } from "@clerk/nextjs/server";
   import { XXXSchema } from "@/lib/schemas";
   import { z } from "zod";

   // サーバーアクション関数
   export async function createXXX(data: z.infer<typeof XXXSchema>) {
     try {
       // 1. 認証チェック
       // 2. バリデーション
       // 3. DB操作
       // 4. レスポンス返却
     } catch (error) {
       // エラーハンドリング
     }
   }
   ```

2. **認証パターン**

   ```typescript
   const user = await currentUser();
   if (!user) {
     return { success: false, error: "認証が必要です" };
   }
   ```

3. **ロールチェック**（必要な場合）

   ```typescript
   const dbUser = await db.user.findUnique({
     where: { clerkId: user.id },
   });

   if (dbUser?.role !== "ADMIN") {
     return { success: false, error: "管理者権限が必要です" };
   }
   ```

4. **バリデーションパターン**

   ```typescript
   const validated = XXXSchema.parse(data);
   ```

5. **DB操作パターン**

   ```typescript
   const result = await db.xxx.create({
     data: validated,
   });
   ```

6. **エラーハンドリング**

   ```typescript
   try {
     // ...
   } catch (error) {
     console.error("createXXX error:", error);
     return { success: false, error: "作成に失敗しました" };
   }
   ```

7. **レスポンス形式**

   ```typescript
   return { success: true, data: result };
   // または
   return { success: false, error: "エラーメッセージ" };
   ```

### 2. Zodスキーマの確認

`src/lib/schemas.ts` を読み込み、既存のバリデーションスキーマを確認：

```typescript
// Read tool で以下のファイルを読み込む
src/lib/schemas.ts
```

以下を確認：
- 既存のスキーマ命名規則（`XXXSchema` 形式）
- フィールドのバリデーションパターン（min, max, email, url など）
- カスタムバリデーションの実装方法

### 3. テストファクトリの確認

テスト実装に必要な共通インフラを確認：

```typescript
// Read tool で以下のファイルを読み込む
src/config/test-fixtures.ts
src/config/test-helpers.ts
src/config/test-scenarios.ts
```

利用可能なファクトリ関数を特定：
- `createTestUser()` - テストユーザー作成
- `createMockStore()` - テストストア作成
- `createMockProduct()` - テスト商品作成
- その他のドメイン固有ファクトリ

### 4. テンプレート生成

ユーザーの要求内容に基づいて、以下の3つのファイルのテンプレートを生成：

#### A. サーバーアクション実装（`src/queries/XXX.ts`）

```typescript
"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { XXXSchema } from "@/lib/schemas";
import { z } from "zod";

/**
 * [機能の説明]
 * @param data - 入力データ（XXXSchemaでバリデーション）
 * @returns { success: boolean, data?: XXX, error?: string }
 */
export async function createXXX(data: z.infer<typeof XXXSchema>) {
  try {
    // 1. 認証チェック
    const user = await currentUser();
    if (!user) {
      return { success: false, error: "認証が必要です" };
    }

    // 2. バリデーション
    const validated = XXXSchema.parse(data);

    // 3. DB操作
    const result = await db.xxx.create({
      data: {
        ...validated,
        userId: user.id,
      },
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("createXXX error:", error);
    return { success: false, error: "作成に失敗しました" };
  }
}

/**
 * [一覧取得の説明]
 * @returns { success: boolean, data?: XXX[], error?: string }
 */
export async function getXXXList() {
  try {
    const user = await currentUser();
    if (!user) {
      return { success: false, error: "認証が必要です" };
    }

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

/**
 * [更新の説明]
 * @param id - XXX ID
 * @param data - 更新データ
 * @returns { success: boolean, data?: { count: number }, error?: string }
 */
export async function updateXXX(
  id: string,
  data: z.infer<typeof XXXSchema>
) {
  try {
    const user = await currentUser();
    if (!user) {
      return { success: false, error: "認証が必要です" };
    }

    const validated = XXXSchema.parse(data);

    // 権限チェックを含むアトミックな更新: 自分のデータのみ更新可能
    const result = await db.xxx.updateMany({
      where: { id, userId: user.id },
      data: validated,
    });

    if (result.count === 0) {
      return { success: false, error: "権限がありません" };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("updateXXX error:", error);
    return { success: false, error: "更新に失敗しました" };
  }
}

/**
 * [削除の説明]
 * @param id - XXX ID
 * @returns { success: boolean, error?: string }
 */
export async function deleteXXX(id: string) {
  try {
    const user = await currentUser();
    if (!user) {
      return { success: false, error: "認証が必要です" };
    }

    // 権限チェックを含むアトミックな削除: 自分のデータのみ削除可能
    const result = await db.xxx.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      return { success: false, error: "権限がありません" };
    }

    return { success: true };
  } catch (error) {
    console.error("deleteXXX error:", error);
    return { success: false, error: "削除に失敗しました" };
  }
}
```

#### B. Zodスキーマ（`src/lib/schemas.ts` への追加案）

```typescript
// src/lib/schemas.ts に以下を追加

export const XXXSchema = z.object({
  field1: z.string().min(2, "2文字以上必要です"),
  field2: z.number().positive("正の数が必要です"),
  field3: z.string().email("有効なメールアドレスを入力してください").optional(),
  // 必要に応じて追加のフィールド
});

export type XXXInput = z.infer<typeof XXXSchema>;
```

#### C. ユニットテスト（`src/queries/XXX.test.ts`）

```typescript
import { createXXX, getXXXList, updateXXX, deleteXXX } from "./XXX";
import { mockAuth, mockPrisma } from "@/config/test-helpers";
import { createTestUser, createTestXXX } from "@/config/test-fixtures";

// Mock設定
jest.mock("@clerk/nextjs/server");
jest.mock("@/lib/db");

describe("XXX サーバーアクション", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createXXX", () => {
    it("正常ケース: データを作成できる", async () => {
      // Arrange: テストデータ準備
      const testUser = createTestUser({ role: "USER" });
      mockAuth({ userId: testUser.clerkId, role: "USER" });

      const inputData = {
        field1: "テスト値",
        field2: 100,
      };

      const expectedResult = {
        id: "xxx-123",
        ...inputData,
        userId: testUser.clerkId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.xxx.create.mockResolvedValue(expectedResult);

      // Act: 関数実行
      const result = await createXXX(inputData);

      // Assert: 結果検証
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedResult);
      expect(mockPrisma.xxx.create).toHaveBeenCalledWith({
        data: {
          ...inputData,
          userId: testUser.clerkId,
        },
      });
    });

    it("異常ケース: 未認証の場合エラーを返す", async () => {
      // Arrange
      mockAuth(null);

      // Act
      const result = await createXXX({ field1: "テスト", field2: 100 });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("認証が必要です");
      expect(mockPrisma.xxx.create).not.toHaveBeenCalled();
    });

    it("異常ケース: バリデーションエラーの場合エラーを返す", async () => {
      // Arrange
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId, role: "USER" });

      const invalidData = {
        field1: "a", // 2文字未満（バリデーションエラー）
        field2: 100,
      };

      // Act
      const result = await createXXX(invalidData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getXXXList", () => {
    it("正常ケース: ユーザーのXXX一覧を取得できる", async () => {
      // Arrange
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId, role: "USER" });

      const testData = [
        createTestXXX({ userId: testUser.clerkId }),
        createTestXXX({ userId: testUser.clerkId }),
      ];

      mockPrisma.xxx.findMany.mockResolvedValue(testData);

      // Act
      const result = await getXXXList();

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
      expect(mockPrisma.xxx.findMany).toHaveBeenCalledWith({
        where: { userId: testUser.clerkId },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("updateXXX", () => {
    it("正常ケース: 自分のデータを更新できる", async () => {
      // Arrange
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId, role: "USER" });

      const existingData = createTestXXX({ userId: testUser.clerkId });
      const updateData = { field1: "更新後", field2: 200 };

      mockPrisma.xxx.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await updateXXX(existingData.id, updateData);

      // Assert
      expect(result.success).toBe(true);
      // 注: updateManyは更新されたデータを返さないため、必要に応じて成功のステータスと引数をチェックします
      expect(mockPrisma.xxx.updateMany).toHaveBeenCalledWith({
        where: { id: existingData.id, userId: testUser.clerkId },
        data: updateData
      });
    });

    it("異常ケース: 他人のデータは更新できない", async () => {
      // Arrange
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId, role: "USER" });

      const existingData = createTestXXX({ userId: "other-user-id" });
      mockPrisma.xxx.updateMany.mockResolvedValue({ count: 0 });

      // Act
      const result = await updateXXX(existingData.id, {
        field1: "更新後",
        field2: 200,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("権限がありません");
    });
  });

  describe("deleteXXX", () => {
    it("正常ケース: 自分のデータを削除できる", async () => {
      // Arrange
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId, role: "USER" });

      const existingData = createTestXXX({ userId: testUser.clerkId });
      mockPrisma.xxx.deleteMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await deleteXXX(existingData.id);

      // Assert
      expect(result.success).toBe(true);
      expect(mockPrisma.xxx.deleteMany).toHaveBeenCalledWith({
        where: { id: existingData.id, userId: testUser.clerkId },
      });
    });

    it("異常ケース: 他人のデータは削除できない", async () => {
      // Arrange
      const testUser = createTestUser();
      mockAuth({ userId: testUser.clerkId, role: "USER" });

      const existingData = createTestXXX({ userId: "other-user-id" });
      mockPrisma.xxx.deleteMany.mockResolvedValue({ count: 0 });

      // Act
      const result = await deleteXXX(existingData.id);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("権限がありません");
    });
  });
});
```

### 5. 既存テストファクトリの参照

`src/config/test-fixtures.ts` の利用可能なファクトリ関数をリストアップ：

```markdown
## 利用可能なテストファクトリ

以下のファクトリ関数がすでに実装されています：

- `createTestUser(overrides?: Partial<User>)` - テストユーザー作成
- `createTestStore(overrides?: Partial<Store>)` - テストストア作成
- `createTestProduct(overrides?: Partial<Product>)` - テスト商品作成
- `createTestProductVariant(overrides?: Partial<ProductVariant>)` - テストバリアント作成
- `createTestSize(overrides?: Partial<Size>)` - テストサイズ作成
- その他...

新しいファクトリが必要な場合は、`src/config/test-fixtures.ts` に追加してください。
```

### 6. 生成内容のサマリー

テンプレート生成後、以下の形式でサマリーを表示：

```markdown
## Server Action Scaffold 生成結果

### 生成されたファイル

1. **src/queries/XXX.ts** (サーバーアクション)
   - `createXXX()` - 新規作成
   - `getXXXList()` - 一覧取得
   - `updateXXX()` - 更新
   - `deleteXXX()` - 削除

2. **src/lib/schemas.ts への追加** (Zodスキーマ)
   - `XXXSchema` - 入力バリデーション
   - `XXXInput` - 型定義

3. **src/queries/XXX.test.ts** (ユニットテスト)
   - `createXXX` のテスト（正常・異常ケース）
   - `getXXXList` のテスト
   - `updateXXX` のテスト（権限チェック含む）
   - `deleteXXX` のテスト（権限チェック含む）

### 次のアクション

- [ ] 生成されたコードを確認・カスタマイズ
- [ ] 必要に応じて追加のバリデーションを実装
- [ ] テストを実行: `bun run test -- --testPathPattern=src/queries/XXX.test.ts`
- [ ] 仕様書を更新: `specs/multi-vendor-ecommerce/04-interfaces.md`
- [ ] コミット: `git add src/queries/XXX.* src/lib/schemas.ts && git commit`
```

## 重要なルール（Critical Rules）

### 必須事項

1. **`"use server"` ディレクティブ**
   - すべてのサーバーアクションファイルの先頭に必ず記述

2. **`currentUser()` で認証チェック**
   - 全てのサーバーアクションで認証状態を確認
   - 未認証の場合は `{ success: false, error: "認証が必要です" }` を返す

3. **`try/catch` でエラーハンドリング**
   - 全てのサーバーアクションを try/catch で囲む
   - エラー時は `console.error()` でログ出力
   - ユーザーに分かりやすいエラーメッセージを返す

4. **Zodスキーマによるバリデーション**
   - 入力データは必ず `XXXSchema.parse(data)` でバリデーション
   - バリデーションエラーはZodが自動的にthrowする

5. **一貫性のあるレスポンス形式**

   ```typescript
   // 成功時
   return { success: true, data: result };

   // エラー時
   return { success: false, error: "エラーメッセージ" };
   ```

### 禁止事項

1. **`any` 型の使用**
   - TypeScript strict modeが有効のため、`any` は禁止
   - 型が不明な場合は `unknown` を使用し、型ガードで絞り込む

2. **直接のPrismaClient インポート**
   - `new PrismaClient()` は禁止
   - 必ず `import { db } from "@/lib/db"` を使用（シングルトン）

3. **`src/queries/` 以外でのサーバーアクション定義**
   - サーバーアクションは `src/queries/` にのみ配置
   - `src/actions/` ディレクトリは存在しない

4. **禁止: Client Components must not import server actions directly**
   - 許可: Server Components or Server Actions may import from `src/queries/` (e.g., use Server Component -> Server Action -> `src/queries/`), and reference `src/components/` only for UI.
   - `src/queries/` からのインポートはサーバーサイドコード（Server Component または Server Action）からのみ可能。

### 推奨事項

1. **テストファクトリの活用**
   - `src/config/test-fixtures.ts` のファクトリ関数を積極的に使用
   - 新しいドメインに対しては新しいファクトリを追加

2. **AAA パターンのテスト**
   - Arrange (準備)
   - Act (実行)
   - Assert (検証)
   - テストの可読性を重視

3. **権限チェックの実装**
   - データの更新・削除時は必ず権限チェック
   - `userId` や `role` による適切なアクセス制御

4. **詳細なエラーメッセージ**
   - ユーザーが理解できるエラーメッセージ
   - デバッグ用の console.error() も忘れずに

## 参考: 主要ファイルパス

### サーバーアクション

- `src/queries/product.ts` - 商品管理（参考実装）
- `src/queries/store.ts` - ストア管理（参考実装）
- `src/queries/user.ts` - ユーザー管理（参考実装）

### スキーマ・型定義

- `src/lib/schemas.ts` - Zodスキーマ定義
- `src/lib/types.ts` - TypeScript型定義
- `src/lib/db.ts` - Prismaシングルトン

### テスト

- `src/config/test-fixtures.ts` - テストファクトリ
- `src/config/test-helpers.ts` - テストヘルパー
- `src/config/test-scenarios.ts` - テストシナリオ
- `src/config/test-config.ts` - テスト定数

## 使用例

### 例1: お気に入り商品管理のサーバーアクション

```
ユーザー: 「新しいサーバーアクション: ユーザーのお気に入り商品を管理」

Claude:
（このスキルが自動実行される）

1. src/queries/product.ts, store.ts を読み込みパターン学習
   - "use server" ディレクティブ
   - currentUser() 認証チェック
   - try/catch エラーハンドリング
   - { success, data, error } レスポンス形式

2. src/lib/schemas.ts を読み込み既存スキーマ確認
   - ProductSchema, StoreSchema などの命名規則を確認

3. src/config/test-fixtures.ts を読み込みファクトリ確認
   - createTestUser(), createTestProduct() が利用可能

4. テンプレート生成:
   a) src/queries/favorite.ts
      - createFavorite(productId: string)
      - getFavoriteList()
      - deleteFavorite(favoriteId: string)

   b) src/lib/schemas.ts への追加
      - FavoriteSchema = z.object({ productId: z.string().uuid() })

   c) src/queries/favorite.test.ts
      - AAA パターンのテスト
      - 正常・異常ケース網羅

5. サマリー表示と次のアクション提案
```

### 例2: ストアフォロー機能のサーバーアクション

```
ユーザー: 「サーバーアクション追加: ユーザーがストアをフォローできる機能」

Claude:
（このスキルが自動実行される）

1. 既存パターン学習

2. テンプレート生成:
   a) src/queries/store-follow.ts
      - followStore(storeId: string)
      - unfollowStore(storeId: string)
      - getFollowedStores()
      - isFollowing(storeId: string)

   b) src/lib/schemas.ts への追加
      - StoreFollowSchema = z.object({ storeId: z.string() })

   c) src/queries/store-follow.test.ts
      - 各関数の正常・異常ケーステスト
      - 重複フォローの防止テスト
      - 権限チェックテスト

3. 必要なPrismaモデル提案:
   model StoreFollow {
     id        String   @id @default(uuid())
     userId    String
     storeId   String
     createdAt DateTime @default(now())

     user  User  @relation(fields: [userId], references: [id])
     store Store @relation(fields: [storeId], references: [id])

     @@unique([userId, storeId])
   }

4. サマリー表示
```

## まとめ

このスキルは、サーバーアクション実装の一貫性と品質を保証します：

- ✅ 既存パターンの学習と適用
- ✅ "use server", 認証, try/catch の徹底
- ✅ Zodスキーマによる型安全なバリデーション
- ✅ AAA パターンのユニットテスト自動生成
- ✅ テストファクトリの活用

多数のテストが実証する高品質なサーバーアクションパターンを維持しながら、新機能の開発を加速します。
