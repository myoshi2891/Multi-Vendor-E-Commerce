---
name: test-gen
description: >
  Analyzes existing production code, identifies untested paths and edge cases,
  and generates comprehensive test cases using the project's test infrastructure.
  Supports unit (Jest), component (RTL), and E2E (Playwright) test generation.
  Triggered by: "テスト追加", "テストケース追加", "テスト補完", "テスト生成",
  "カバレッジ改善", "不足テスト", "テストギャップ", "add tests", "generate tests",
  "test gap", "improve coverage", "missing tests", "write tests for".
invocation: automatic
allowed-tools: [Read, Grep, Glob, Bash, Edit, Write]
---

# Test Gen スキル

## 目的

既存コードのテストギャップを分析し、不足しているテストケースを生成・追加するスキル。`server-action-scaffold`（新規モジュール雛形生成）とは異なり、**既に存在するコードへのテスト補完**に特化する。

---

## 実行手順（この順番を厳守すること）

### Step 1｜スコープを決定する

ユーザーの指示から対象を特定する：

| 指示例 | スコープ | テスト種別 |
|--------|---------|-----------|
| 「store.ts のテストを追加して」 | 単一モジュール | ユニット |
| 「コンポーネントのテストを書いて」 | `src/components/` 配下 | コンポーネント |
| 「チェックアウトフローの E2E を追加」 | ユーザーフロー | E2E |
| 「カバレッジを改善して」 | 低カバレッジモジュール全体 | ユニット |
| 「P0 テストを追加して」 | QA 観点の最優先項目 | 混合 |

スコープが不明確な場合はユーザーに確認する。

---

### Step 2｜テストインフラを読み込む

以下の 4 ファイルを**必ず**読んでから生成に着手する：

```
Read: src/config/test-fixtures.ts     # ファクトリ関数一覧を把握
Read: src/config/test-helpers.ts      # AuthTestHelpers / AssertionHelpers を把握
Read: src/config/test-scenarios.ts    # 境界値・状態遷移パターンを把握
Read: src/config/test-config.ts       # 定数・エッジケース文字列を把握
```

利用可能なファクトリ・ヘルパー・シナリオをリストアップし、テスト生成時に最大限活用する。

---

### Step 3｜本番コードを分析する

対象ファイルを読み込み、以下を列挙する：

| 分析項目 | 抽出内容 |
|---------|---------|
| **export 関数** | 全公開関数のシグネチャ |
| **分岐パス** | `if/else`, `switch`, 早期リターン, `try/catch` |
| **エラーパス** | throw, `{ success: false }`, `console.error` |
| **外部依存** | Prisma 操作, Clerk 認証, Stripe/PayPal API |
| **Decimal 演算** | `.add()`, `.mul()`, `.sub()`, `.toNumber()` |
| **トランザクション** | `db.$transaction` の使用箇所 |

---

### Step 4｜既存テストを分析しギャップを特定する

対象モジュールの `*.test.ts` を読み込み、カバー済みケースをマッピングする。

**ギャップ分類（優先度順）:**

| 優先度 | カテゴリ | 例 |
|--------|---------|-----|
| **P0** | セキュリティ・データ破損 | 認証バイパス、IDOR、二重課金、在庫不整合 |
| **P1** | ビジネスロジック不整合 | 配送料誤計算、クーポン期限無視、注文ステータス不正遷移 |
| **P2** | エッジケース・境界値 | 空配列、null/undefined、長文字列、Decimal 精度 |
| **P3** | エラーハンドリング | DB 接続失敗、外部 API タイムアウト |

QA 観点の詳細は `docs/testing/QA_TEST_PERSPECTIVES.md` を参照する。

**ギャップレポートをユーザーに提示して確認を取る：**

```markdown
## テストギャップ分析: `src/queries/XXX.ts`

### カバー済み（N/M 関数）
- ✅ createXXX: 正常系, 未認証, バリデーション
- ✅ getXXXList: 正常系, 未認証

### 未カバー（M-N 関数・パス）
- ❌ updateXXX: 分岐 — 他人データ更新拒否 [P0]
- ❌ deleteXXX: 全ケース未テスト [P1]
- ❌ createXXX: DB 例外時のエラーハンドリング [P3]
- ❌ getXXXList: 空結果の場合 [P2]

### 追加予定テスト数: N 件
```

---

### Step 5｜テストを生成する

#### 5-A. ユニットテスト（Jest）

**配置先:** 対象ファイルと同階層の `*.test.ts`

**必須パターン:**

```typescript
// モック構成（既存テストファイルのパターンを踏襲）
jest.mock("@/lib/db", () => ({
  db: { /* 対象モデルのモック */ },
}));
jest.mock("@clerk/nextjs/server");

// テストインフラの import
import { createMockXXX } from "@/config/test-fixtures";
import { AuthTestHelpers, AssertionHelpers } from "@/config/test-helpers";

describe("関数名", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("正常系", () => {
    it("正常系: [期待動作を記述]", async () => {
      // Arrange — ファクトリでテストデータ生成
      // Act — 関数呼び出し
      // Assert — 結果検証
    });
  });

  describe("異常系", () => {
    it("異常系: 未認証の場合エラーをスローする", async () => { ... });
    it("異常系: 権限不足の場合エラーを返す", async () => { ... });
    it("異常系: DB 操作失敗時にエラーを返す", async () => { ... });
  });

  describe("エッジケース", () => {
    it("エッジケース: 空の結果セットを返す", async () => { ... });
    it("境界値: Decimal 精度が保持される", async () => { ... });
  });
});
```

**認証テスト 3 軸（全サーバーアクションで必須）:**

```typescript
// 1. 認証済み正常
AuthTestHelpers.mockAuthenticated("USER");

// 2. 未認証
AuthTestHelpers.mockUnauthenticated();

// 3. 権限不足（ロール別）
AuthTestHelpers.mockAuthenticated("USER"); // ADMIN 専用操作に USER でアクセス
```

**Decimal テスト:**

```typescript
import { Prisma } from "@prisma/client";

// モックデータは Prisma.Decimal を使用
const mockSize = createMockSize({
  price: new Prisma.Decimal("99.99") as never,
});

// Decimal 演算結果の検証
expect(result.total.toNumber()).toBeCloseTo(199.98, 2);
```

#### 5-B. コンポーネントテスト（Jest + RTL）

**配置先:** `tests/component/[コンポーネントパス].test.tsx`

```typescript
/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ComponentName", () => {
  it("正常系: 初期状態で正しく描画される", () => {
    render(<Component {...defaultProps} />);
    expect(screen.getByRole("button", { name: /追加/i })).toBeInTheDocument();
  });

  it("正常系: ユーザー操作で状態が更新される", async () => {
    const user = userEvent.setup();
    render(<Component {...defaultProps} />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("更新済み")).toBeInTheDocument();
  });
});
```

#### 5-C. E2E テスト（Playwright）

**配置先:** `tests/e2e/[フロー名].spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("チェックアウトフロー", () => {
  test("正常系: 商品をカートに追加して注文を完了できる", async ({ page }, testInfo) => {
    const workerSuffix = `${testInfo.project.name}-w${testInfo.workerIndex}`;
    // ワーカー固有のシードデータを使用
    await page.goto("/");
    // ... フロー実行
  });
});
```

---

### Step 6｜テストを実行して検証する

```bash
# 生成したテストのみ実行
bun run test -- --testPathPattern=<生成ファイルパス>

# 全テストが引き続きパスすることを確認
bun run test
```

**全テストがパスしない場合:**
1. 失敗原因を分析（モック不足・型エラー・実装バグ）
2. テストコードの修正（モック追加・型修正）
3. 実装バグを発見した場合はユーザーに報告し、修正を提案する

---

### Step 7｜レポートを出力する

```markdown
## テスト追加レポート

### 対象: `src/queries/XXX.ts`

### 追加テスト
| # | テスト名 | 優先度 | カテゴリ |
|---|---------|--------|---------|
| 1 | 正常系: XXX を作成できる | P1 | ビジネスロジック |
| 2 | 異常系: 未認証の場合エラー | P0 | セキュリティ |
| 3 | エッジケース: 空配列の場合 | P2 | 境界値 |

### テスト結果
- 追加: N tests
- 全体: M tests, K suites (all passing)

### 次のアクション
- [ ] テスト内容を確認
- [ ] `test-complete` スキルでコミット前チェックを実行
```

---

## 重要ルール

### ❌ 絶対禁止

- `any` 型の使用（`unknown` + 型ガードで代替する）
- 既存テストの削除・書き換え（追加のみ行う）
- テストインフラ未読でのテスト生成着手
- `it.skip()` / `it.only()` のコミット
- テスト内での `console.log()` の残留
- `@ts-ignore` による型エラーの無視

### ✅ 必須

- テスト名は日本語で「正常系:」「異常系:」「エッジケース:」「境界値:」の接頭辞を付ける
- AAA パターン（Arrange / Act / Assert）を厳守する
- 既存テストファイルのモック構成・describe 構造・命名規則を踏襲する
- 金額フィールドは `new Prisma.Decimal("value")` を使用する
- 認証が必要な関数は「認証済み正常 / 未認証 / 権限不足」の 3 軸でテストする
- catch ブロックのテストでは `error: unknown` + `instanceof Error` パターンを検証する
- テスト実行後、全テストがパスすることを確認してからレポートする

### 💡 推奨

- `src/config/test-scenarios.ts` の境界値・遷移パターンを積極的に活用する
- `docs/testing/QA_TEST_PERSPECTIVES.md` の P0 項目を優先的にカバーする
- 既存ファクトリに不足がある場合は `test-fixtures.ts` に追加を提案する
- トランザクション（`db.$transaction`）のテストでは `MockPrismaClient` パターンを参照する

---

## 参考: テスト種別と配置先

| 種別 | 対象 | 配置先 | 環境 |
|-----|------|--------|------|
| ユニット | `src/queries/*.ts` | `src/queries/*.test.ts` | node |
| ユニット | `src/lib/*.ts` | `src/lib/*.test.ts` | node |
| ユニット | `src/cart-store/` | `src/cart-store/*.test.ts` | node |
| コンポーネント | `src/components/**/*.tsx` | `tests/component/**/*.test.tsx` | jsdom |
| API ルート | `src/app/api/**` | `src/app/api/**/route.test.ts` | node |
| シード | `prisma/seed/**` | `prisma/seed/__tests__/*.test.ts` | node |
| E2E | ユーザーフロー | `tests/e2e/*.spec.ts` | Playwright |

---

## 参考: 主要ファイルパス

```
# テスト共通インフラ（必須参照）
src/config/test-fixtures.ts        ファクトリ関数（20+ エンティティ）
src/config/test-helpers.ts         認証モック・アサーションヘルパー
src/config/test-scenarios.ts       境界値・状態遷移・配送料パターン
src/config/test-config.ts          テスト定数・エッジケース文字列

# QA 観点（ギャップ分析用）
docs/testing/QA_TEST_PERSPECTIVES.md   P0/P1/P2 リスク優先度マスタ

# テスト設計ドキュメント
docs/testing/TESTING_DESIGN.md     テストピラミッド・ディレクトリ構成

# 参考テスト（パターン学習用）
src/queries/store.test.ts          最大テストスイート（$transaction モック含む）
src/queries/product.test.ts        Decimal テスト・配送料テスト
src/queries/user.test.ts           カート・チェックアウト・注文テスト

# 関連スキル
.claude/skills/server-action-scaffold/SKILL.md   新規モジュール用（既存コードには本スキルを使用）
.claude/skills/test-complete/SKILL.md             テスト実行・品質判定
```
