---
name: test-complete
description: >
  テストを実行し、結果をレポートする。
  「テスト実行」「test run」「テスト確認」「カバレッジ確認」
  「テストチェック」「品質チェック」などのキーワードで使用。
  コミット前の自動確認にも使用。
invocation: automatic
allowed-tools: [Bash, Read, Grep]
---

# Test Complete

## 目的

テストを実行し、カバレッジを確認し、結果をレポートする。

このプロジェクトには、多数のユニットテスト（Jest）とE2Eテスト（Playwright）が実装されており（現在の実行結果からテスト数を集計して表示します）、コミット前の品質チェックが必須です。

## トリガー条件

以下の場合に自動的に実行されます：

- ユーザーが「テスト実行」「test run」「テスト確認」と言った場合
- 「カバレッジ確認」「品質チェック」「テストチェック」などの表現を使った場合
- コミット前の自動確認（推奨）

## 実行手順

### 1. テスト種別の確認

ユーザーの要求に基づいて、実行するテストを決定：

- **ユニットテスト（Jest）**: `bun run test`
- **E2Eテスト（Playwright）**: `bunx playwright test`
- **特定ファイル**: `bun run test -- --testPathPattern=<pattern>`
- **型チェック・リント**: `bun run lint`, `bunx tsc --noEmit`

明示的な指定がない場合は、**ユニットテスト + 型チェック + リント**を実行。

### 2. ユニットテスト実行（Jest）

#### A. 全テスト実行

```bash
bun run test
```

出力から以下の情報を抽出：

- 実行されたテスト数
- 成功したテスト数
- 失敗したテスト数
- カバレッジ情報（ステートメント、ブランチ、関数、ライン）

#### B. 特定ファイルのテスト実行

```bash
bun run test -- --testPathPattern=src/queries/product.test.ts
```

#### C. カバレッジ付き実行（詳細確認時）

```bash
bun run test -- --coverage
```

#### D. ウォッチモード（開発時）

```bash
bun run test:watch
```

### 3. 失敗したテストの詳細抽出

テストが失敗した場合、以下の情報を抽出：

- **テストファイル名**: 失敗したテストが含まれるファイル
- **テスト名**: `describe` と `it` のブロック名
- **エラーメッセージ**: Jestが出力したエラー内容
- **失敗箇所**: スタックトレースから該当行を特定

例:

```
❌ 失敗したテスト:
   - ファイル: src/queries/product.test.ts
   - テスト: "createProduct > 正常ケース: 商品を作成できる"
   - エラー: Expected { success: true } but got { success: false, error: "..." }
   - 行番号: product.test.ts:45
```

### 4. E2Eテスト実行（Playwright）

必要な場合のみ実行（ユーザーが明示的に要求した場合、または重要な変更がある場合）。

#### A. 全E2Eテスト実行

```bash
bunx playwright test
```

#### B. 特定ブラウザのみ

```bash
bunx playwright test --project=chromium
```

#### C. 特定テストのみ

```bash
bunx playwright test tests/e2e/cart-smoke.spec.ts
```

#### D. UI モードで実行（開発時）

```bash
bunx playwright test --ui
```

### 5. E2Eシードデータの確認

E2Eテストを実行する前に、シードデータが投入されているか確認：

```bash
# シードデータ投入スクリプトの存在確認
ls -la tests/e2e/seed/seed-e2e.ts
```

必要な場合は、シードデータを投入：

```bash
bun run seed:e2e
```

### 6. 型チェック・リント

#### A. TypeScript 型チェック

```bash
bunx tsc --noEmit
```

型エラーが検出された場合：

- エラーが発生したファイル名
- エラーメッセージ
- 行番号

を抽出してレポート。

#### B. ESLint 実行

```bash
bun run lint
```

リントエラー・警告が検出された場合：

- ルール名（例: `@typescript-eslint/no-unused-vars`）
- ファイル名と行番号
- エラーメッセージ

を抽出してレポート。

### 7. レポート生成

以下の形式でテスト実行結果をレポート：

```markdown
## テスト実行結果

### ユニットテスト（Jest）

- **実行**: [集計されたテスト総数] tests
- **成功**: [成功数] passed
- **失敗**: [失敗数] failed
- **スキップ**: [スキップ数] skipped
- **カバレッジ**:
  - Statements: 85.5%
  - Branches: 78.2%
  - Functions: 82.1%
  - Lines: 85.3%

### 失敗したテスト

#### 1. src/queries/product.test.ts

**テスト**: `createProduct > 正常ケース: 商品を作成できる`

**エラー**:
```

Expected: { success: true, data: {...} }
Received: { success: false, error: "バリデーションエラー" }

```

**原因**:
- `ProductSchema` のバリデーションルールが変更された可能性
- テストデータが古い形式になっている

**推奨対応**:
1. src/lib/schemas.ts の `ProductSchema` を確認
2. テストデータを最新のスキーマに合わせて更新
3. src/config/test-fixtures.ts の `createTestProduct()` を確認

---

#### 2. src/queries/store.test.ts

（同様の形式で記述）

---

### E2Eテスト（Playwright）

（実行した場合のみ）

- **実行**: 12 tests (Chromium: 4, Firefox: 4, WebKit: 4)
- **成功**: 12 passed
- **失敗**: 0 failed
- **所要時間**: 45.3s

---

### 型チェック（TypeScript）

- **ステータス**: ✅ エラーなし

または

- **ステータス**: ❌ エラーあり
- **エラー数**: 5 errors

#### エラー詳細

1. **src/queries/product.ts:42:15**
   ```

   Type 'string | undefined' is not assignable to type 'string'.

   ```

   **推奨対応**:
   - オプショナル型の扱いを確認
   - 型ガードまたは nullish coalescing (`??`) を使用

---

### リント（ESLint）

- **ステータス**: ✅ エラー・警告なし

または

- **ステータス**: ⚠️ 警告あり
- **エラー数**: 0 errors
- **警告数**: 3 warnings

#### 警告詳細

1. **src/components/store/ProductCard.tsx:28:10**
   - **ルール**: `@next/next/no-img-element`
   - **メッセージ**: Do not use `<img>`. Use `<Image />` from `next/image` instead.

   **推奨対応**:
   - `<img>` を `<Image />` に置き換え
```

### 8. 次のアクション提案

テスト結果に基づいて、次に取るべきアクションを提案：

#### A. 失敗したテストがある場合

```markdown
## 次のアクション

### 必須（コミット前に修正が必要）

- [ ] src/queries/product.test.ts の失敗テストを修正
- [ ] src/queries/store.test.ts の失敗テストを修正
- [ ] 型エラーを修正（src/queries/product.ts:42）

### 推奨（品質向上のため）

- [ ] カバレッジ80%未満の箇所にテストを追加
  - src/queries/coupon.ts: 65.3%
  - src/queries/offer-tag.ts: 72.1%
- [ ] ESLint警告を修正
```

#### B. テストが全て成功した場合

```markdown
## 次のアクション

✅ 全テスト成功、コミット可能です

推奨：
- [ ] カバレッジレポートを確認（80%未満の箇所があればテスト追加を検討）
- [ ] git add . && git commit -m "..."
```

### 9. コミット判定

テスト結果に基づいて、コミットの可否を判定：

- **✅ コミット可能**: 全テスト成功、型エラーなし、リントエラーなし
- **⚠️ 条件付きコミット可能**: 警告のみ（エラーなし）
- **❌ コミット不可**: テスト失敗、型エラー、またはリントエラーあり

## 重要なルール（Critical Rules）

### 必須事項

1. **コミット前にテストを実行**
   - 全てのコミット前にユニットテストを実行
   - 型チェック・リントも含める

2. **失敗したテストがある場合はコミット禁止**
   - 失敗したテストは必ず修正してからコミット
   - 「後で修正する」は禁止

3. **カバレッジ80%以上を推奨**
   - 新しいコードには必ずテストを追加
   - カバレッジが80%未満の場合は警告

4. **型エラー・リントエラーの修正**
   - TypeScript strict mode が有効
   - 型エラーは必ず修正
   - リントエラーも可能な限り修正

### 禁止事項

1. **テストのスキップ（`.skip()`, `.only()`）をコミット**

   ```typescript
   // ❌ 禁止
   it.skip("テストケース", () => { ... });
   it.only("このテストだけ実行", () => { ... });
   ```

   - デバッグ時の一時的な使用は可
   - コミット前に必ず削除

2. **型エラーを無視する**

   ```typescript
   // ❌ 禁止
   // @ts-ignore
   const value = someFunction();
   ```

   - 型エラーの根本原因を解決
   - やむを得ない場合は `@ts-expect-error` に理由コメント付き

3. **`console.log()` をコミット**

   ```typescript
   // ❌ 禁止（デバッグ用）
   console.log("デバッグ:", value);
   ```

   - デバッグ用の `console.log()` は削除
   - 必要な場合は適切なロガーを使用

### 推奨事項

1. **AAAパターンのテスト**
   - Arrange (準備)
   - Act (実行)
   - Assert (検証)

2. **意味のあるテスト名**

   ```typescript
   // ✅ 良い例
   it("正常ケース: 商品を作成できる", () => { ... });
   it("異常ケース: 未認証の場合エラーを返す", () => { ... });

   // ❌ 悪い例
   it("test1", () => { ... });
   it("works", () => { ... });
   ```

3. **E2Eテストは重要な変更時のみ**
   - E2Eテストは実行時間が長い
   - UI変更やワークフロー変更時に実行
   - ユニットテストで十分な場合は省略可

## 参考: 主要コマンド

### ユニットテスト（Jest）

```bash
# 全テスト実行
bun run test

# 特定ファイル
bun run test -- --testPathPattern=src/queries/product.test.ts

# カバレッジ付き
bun run test -- --coverage

# ウォッチモード
bun run test:watch

# 更新されたファイルのみ
bun run test -- --onlyChanged
```

### E2Eテスト（Playwright）

```bash
# 全テスト実行
bunx playwright test

# 特定ブラウザ
bunx playwright test --project=chromium

# 特定ファイル
bunx playwright test tests/e2e/cart-smoke.spec.ts

# UIモード
bunx playwright test --ui

# シードデータ投入
bun run seed:e2e
```

### 型チェック・リント

```bash
# TypeScript型チェック
bunx tsc --noEmit

# ESLint
bun run lint

# ESLint 自動修正
bun run lint --fix

# Prettier
bunx prettier --check .
bunx prettier --write <file>
```

### Prisma関連

```bash
# Prismaクライアント再生成
bunx prisma generate

# スキーマ検証
bunx prisma validate

# Prisma Studio（DBブラウザ）
bunx prisma studio
```

## 参考: 主要ファイルパス

### テスト設定

- `jest.config.js` - Jest設定
- `playwright.config.ts` - Playwright設定
- `tests-setup/jest.setup.ts` - Jestセットアップ

### テスト

- `src/queries/*.test.ts` - ユニットテスト
- `tests/e2e/*.spec.ts` - E2Eテスト
- `tests/e2e/seed/seed-e2e.ts` - E2Eシードデータ

### テスト共通インフラ

- `src/config/test-fixtures.ts` - テストファクトリ
- `src/config/test-helpers.ts` - テストヘルパー
- `src/config/test-scenarios.ts` - テストシナリオ
- `src/config/test-config.ts` - テスト定数

### ビルド設定

- `package.json` - テストスクリプト
- `tsconfig.json` - TypeScript設定
- `.eslintrc.json` - ESLint設定

## 使用例

### 例1: コミット前の品質チェック

```
ユーザー: 「テスト実行」

Claude:
（このスキルが自動実行される）

1. ユニットテスト実行:
   bun run test

2. 型チェック:
   bunx tsc --noEmit

3. リント:
   bun run lint

4. レポート生成:
   ## テスト実行結果

   ### ユニットテスト（Jest）
   - 実行: [集計されたテスト総数] tests
   - 成功: [成功数] passed ✅
   - 失敗: 0 failed
   - カバレッジ: 85.5%

   ### 型チェック（TypeScript）
   - ステータス: ✅ エラーなし

   ### リント（ESLint）
   - ステータス: ✅ エラー・警告なし

   ## 次のアクション
   ✅ 全テスト成功、コミット可能です
```

### 例2: テスト失敗時の詳細レポート

```
ユーザー: 「品質チェック」

Claude:
（このスキルが自動実行される）

1. テスト実行結果:
   - [集計されたテスト総数] tests, [成功数] passed, [失敗数] failed

2. 失敗テスト詳細抽出:
   - src/queries/product.test.ts: 2 failed
   - src/queries/store.test.ts: 1 failed

3. レポート生成:
   ## テスト実行結果
   ❌ コミット不可: テスト失敗あり

   ### 失敗したテスト
   #### 1. src/queries/product.test.ts
   - "createProduct > 正常ケース"
   - エラー: バリデーションエラー
   - 推奨対応: ProductSchema を確認

   ## 次のアクション
   ### 必須（コミット前に修正が必要）
   - [ ] src/queries/product.test.ts の失敗テストを修正
   - [ ] src/queries/store.test.ts の失敗テストを修正
```

### 例3: E2Eテスト実行

```
ユーザー: 「テスト実行（E2Eも含めて）」

Claude:
1. ユニットテスト実行

2. E2Eシードデータ確認:
   bun run seed:e2e

3. E2Eテスト実行:
   bunx playwright test

4. レポート生成:
   ### E2Eテスト（Playwright）
   - 実行: 12 tests
   - 成功: 12 passed ✅
   - 所要時間: 45.3s
```

## まとめ

このスキルは、コミット前の品質保証を自動化します：

- ✅ ユニットテスト + E2Eテストの統合実行
- ✅ 型チェック + リントの自動確認
- ✅ 失敗テストの詳細レポート
- ✅ 次のアクション提案（修正箇所の特定）
- ✅ コミット可否の明確な判定

多数のユニットテストが保証する高品質なコードベースを維持しながら、継続的な品質向上をサポートします。
