# テスト作成ガイドライン

このドキュメントでは、プロジェクトで一貫性のあるテストを作成するためのガイドラインを説明します。

---

## 1. 命名規則

### テストファイル

```text
// ファイル名は対象ファイルと同じディレクトリに配置
src/queries/store.ts      → src/queries/store.test.ts
src/lib/utils.ts          → src/lib/utils.test.ts
src/app/api/webhooks/route.ts → src/app/api/webhooks/route.test.ts
```

### テストスイート（describe）

```typescript
// 関数名またはモジュール名を使用
describe("upsertStore", () => { ... });
describe("StoreFormSchema", () => { ... });
describe("POST /api/webhooks", () => { ... });
```

### テストケース（it）

日本語での記述を推奨。「〜の場合、〜すること」の形式を使用。

```typescript
// Good
it("認証済みユーザーで有効なデータの場合、新規ストアを作成すること", async () => { ... });
it("未認証ユーザーの場合、Unauthenticatedエラーをスローすること", async () => { ... });

// Bad
it("should create store", async () => { ... });  // 英語でも可だが、日本語で統一推奨
it("test store creation", async () => { ... });  // "test"から始めない
```

---

## 2. テスト構造

### AAA パターン（Arrange-Act-Assert）

すべてのテストは AAA パターンに従って構造化します。

```typescript
it("正常なデータで商品を作成できること", async () => {
    // =====================================
    // Arrange（準備）
    // =====================================
    const mockUser = TestDataFactory.validUser("SELLER");
    const mockStoreData = TestDataFactory.validStoreData();

    TestHelpers.mockCurrentUser(mockUser);
    mockDb.store.findFirst.mockResolvedValue(null); // 重複なし
    mockDb.store.create.mockResolvedValue({ id: "store123", ...mockStoreData });

    // =====================================
    // Act（実行）
    // =====================================
    const result = await upsertStore(mockStoreData);

    // =====================================
    // Assert（検証）
    // =====================================
    expect(result).toEqual(
        expect.objectContaining({
            id: "store123",
            name: mockStoreData.name,
        })
    );
    expect(mockDb.store.create).toHaveBeenCalledTimes(1);
});
```

### 階層的な describe ブロック

関連するテストケースはグループ化します。

```typescript
describe("upsertStore", () => {
    describe("認証・認可", () => {
        it("未認証ユーザーの場合、エラーをスローすること", async () => { ... });
        it("SELLER以外のロールの場合、エラーをスローすること", async () => { ... });
    });

    describe("バリデーション", () => {
        it("ストアデータがnullの場合、エラーをスローすること", async () => { ... });
        it("storeURLが空の場合、エラーをスローすること", async () => { ... });
    });

    describe("重複チェック", () => {
        it("同名のストアが存在する場合、エラーをスローすること", async () => { ... });
        it("同じURLが存在する場合、エラーをスローすること", async () => { ... });
    });

    describe("正常系", () => {
        it("新規ストアを作成できること", async () => { ... });
        it("既存ストアを更新できること", async () => { ... });
    });
});
```

---

## 3. テストカテゴリ

各テストケースは以下のカテゴリに分類されます。

| カテゴリ             | 説明                   | 例                               |
| -------------------- | ---------------------- | -------------------------------- |
| **正常系**           | 期待通りの動作         | 有効なデータで作成成功           |
| **認証テスト**       | 未認証ユーザーの処理   | `currentUser()` が `null` の場合 |
| **認可テスト**       | 権限不足ユーザーの処理 | USERロールでSELLER機能にアクセス |
| **バリデーション**   | 入力値の検証           | 必須フィールドがnull             |
| **異常系**           | エラーハンドリング     | 存在しないID、DB接続エラー       |
| **境界値**           | エッジケースの処理     | 空配列、最大値、最小値           |
| **ビジネスロジック** | 計算・ルール検証       | 割引計算、配送料計算             |
| **外部API**          | 外部サービス連携       | Stripe/PayPal API呼び出し        |
| **フィルター**       | フィルタリング機能     | カテゴリフィルター               |
| **ソート**           | ソート機能             | 価格順、日付順                   |
| **ページネーション** | ページング機能         | skip/take                        |
| **セキュリティ**     | セキュリティ関連       | SQLインジェクション、XSS         |

---

## 4. アサーション

### 推奨パターン

```typescript
// オブジェクト比較（deep equality）
expect(result).toEqual(expectedObject);

// 部分一致
expect(result).toEqual(
    expect.objectContaining({
        id: "123",
        name: "Test",
    })
);

// プリミティブ比較（strict equality）
expect(result.id).toBe("123");
expect(result.count).toBe(5);

// 真偽値
expect(result.isActive).toBe(true);
expect(result.isActive).toBeTruthy();

// null/undefined
expect(result).toBeNull();
expect(result).toBeUndefined();
expect(result).toBeDefined();

// 配列
expect(result).toHaveLength(3);
expect(result).toContain("item");
expect(result).toEqual(expect.arrayContaining(["a", "b"]));

// エラー検証
await expect(promise).rejects.toThrow("Error message");
await expect(promise).rejects.toThrow(Error);

// モック呼び出し検証
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(1);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ key: "value" }));

// モック未呼び出し検証
expect(mockFn).not.toHaveBeenCalled();
```

### 避けるべきパターン

```typescript
// Bad: 曖昧なアサーション
expect(result).toBeTruthy(); // 何がtruthyか不明確

// Good: 明示的なアサーション
expect(result).toEqual(expectedValue);
expect(result.success).toBe(true);

// Bad: 複数の無関係なアサーションを1つのテストに
it("should work", async () => {
    expect(result1).toBe("a");
    expect(result2).toBe("b"); // 関連がない場合は別テストに
});

// Good: 1つのテストに1つの論理的なアサーション
it("should return user name", async () => {
    expect(result.name).toBe("Test User");
});
```

---

## 5. 非同期テスト

### 基本パターン

```typescript
// async/await を使用（推奨）
it("非同期処理が正常に完了すること", async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
});

// Promise を使用
it("Promiseが正常に解決されること", () => {
    return expect(asyncFunction()).resolves.toBe(expectedValue);
});

// エラーの検証
it("非同期エラーがスローされること", async () => {
    await expect(asyncFunction()).rejects.toThrow("Error message");
});
```

### タイムアウト設定

```typescript
// テストファイル全体のタイムアウト
jest.setTimeout(10000); // 10秒

// 個別テストのタイムアウト
it("長時間処理が完了すること", async () => {
    // テスト内容
}, 15000); // 15秒
```

---

## 6. セットアップとクリーンアップ

### beforeEach / afterEach

```typescript
describe("upsertStore", () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        // 各テスト前に実行
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
        // 各テスト後に実行
        consoleLogSpy.mockRestore();
    });

    // テストケース...
});
```

### beforeAll / afterAll

```typescript
describe("DatabaseTests", () => {
    beforeAll(async () => {
        // 全テスト開始前に1回だけ実行
        await setupTestDatabase();
    });

    afterAll(async () => {
        // 全テスト完了後に1回だけ実行
        await cleanupTestDatabase();
    });
});
```

---

## 7. テストデータ

### TestDataFactory パターン

```typescript
// src/config/test-data-factory.ts

export const TestDataFactory = {
    // ユーザーデータ
    validUser: (role: string = "USER") => ({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role },
        emailAddresses: [{ emailAddress: TEST_CONFIG.TEST_EMAIL }],
    }),

    // ストアデータ
    validStoreData: (overrides = {}) => ({
        name: "Test Store",
        description: "A test store description that is long enough",
        email: TEST_CONFIG.TEST_EMAIL,
        phone: TEST_CONFIG.TEST_PHONE,
        url: TEST_CONFIG.TEST_STORE_URL,
        logo: "https://example.com/logo.png",
        cover: "https://example.com/cover.png",
        ...overrides,
    }),

    // 商品データ
    validProductData: (overrides = {}) => ({
        name: "Test Product",
        description: "A test product description...",
        brand: "Test Brand",
        // ...
        ...overrides,
    }),

    // 注文データ
    validOrderData: (overrides = {}) => ({
        id: "order123",
        total: 100.0,
        paymentStatus: "Pending",
        ...overrides,
    }),
};
```

### TEST_CONFIG の活用

```typescript
// src/config/test-config.ts からインポート
import { TEST_CONFIG } from "@/config/test-config";

// 使用例
const userId = TEST_CONFIG.DEFAULT_USER_ID;
const email = TEST_CONFIG.TEST_EMAIL;
const errorMessage = TEST_CONFIG.ERROR_MESSAGES.DATABASE_ERROR;
```

---

## 8. コードカバレッジ

### カバレッジレポート生成

```bash
# カバレッジレポート生成
npm test -- --coverage

# 特定のファイルのカバレッジ
npm test -- --coverage --collectCoverageFrom="src/queries/store.ts"
```

### カバレッジ目標

| メトリクス | 目標 |
| ---------- | ---- |
| Statements | 80%  |
| Branches   | 75%  |
| Functions  | 80%  |
| Lines      | 80%  |

---

## 9. テストファイルのテンプレート

```typescript
/**
 * @file store.test.ts
 * @description ストア管理機能のユニットテスト
 */

import { currentUser } from "@clerk/nextjs/server";
import { upsertStore, getStoreDefaultShippingDetails } from "./store";
import { TEST_CONFIG } from "@/config/test-config";

// =====================================
// モック設定
// =====================================
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        store: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    },
}));

// =====================================
// テストデータファクトリー
// =====================================
const TestDataFactory = {
    validUser: (role = "SELLER") => ({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role },
    }),
    validStoreData: (overrides = {}) => ({
        name: "Test Store",
        email: TEST_CONFIG.TEST_EMAIL,
        ...overrides,
    }),
};

// =====================================
// テストヘルパー
// =====================================
class TestHelpers {
    static mockCurrentUser(user: any) {
        (currentUser as jest.Mock).mockResolvedValue(user);
    }

    static mockUnauthenticated() {
        (currentUser as jest.Mock).mockResolvedValue(null);
    }
}

// =====================================
// テスト本体
// =====================================
describe("upsertStore", () => {
    const mockDb = require("@/lib/db").db;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("認証・認可", () => {
        it("未認証ユーザーの場合、Unauthenticatedエラーをスローすること", async () => {
            // Arrange
            TestHelpers.mockUnauthenticated();

            // Act & Assert
            await expect(
                upsertStore(TestDataFactory.validStoreData())
            ).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("正常系", () => {
        it("有効なデータで新規ストアを作成できること", async () => {
            // Arrange
            TestHelpers.mockCurrentUser(TestDataFactory.validUser());
            mockDb.store.findFirst.mockResolvedValue(null);
            mockDb.store.create.mockResolvedValue({ id: "store123" });

            // Act
            const result = await upsertStore(TestDataFactory.validStoreData());

            // Assert
            expect(result).toBeDefined();
            expect(mockDb.store.create).toHaveBeenCalledTimes(1);
        });
    });
});
```

---

## 10. ベストプラクティス

### Do's（推奨）

- 1つのテストで1つの振る舞いをテストする
- テストケースは独立して実行できるようにする
- モックは最小限に抑え、必要な部分のみモックする
- テストデータはファクトリーパターンで管理する
- エラーメッセージは具体的に検証する
- 境界値テストを含める

### Don'ts（避けるべき）

- 実装の詳細をテストしない（振る舞いをテストする）
- テスト間で状態を共有しない
- `console.log` をテストに残さない
- 本番データベースに接続しない
- 時間依存のテストを書かない（モックを使用）
- 外部APIに直接アクセスしない（モックを使用）
