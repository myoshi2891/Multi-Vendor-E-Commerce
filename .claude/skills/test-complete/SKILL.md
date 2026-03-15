---
name: test-complete
description: >
  Runs unit tests (Jest), optional E2E tests (Playwright), TypeScript type check,
  and ESLint, then reports results with pass/fail details, coverage, and a clear
  commit-readiness judgment. Recommended before every commit.
  Triggered by: "テスト実行", "テスト確認", "カバレッジ確認", "品質チェック",
  "テストチェック", "コミット前確認", "test run", "run tests", "check coverage",
  "quality check", "pre-commit check".
invocation: automatic
allowed-tools: [Bash, Read, Grep]
---

# Test Complete スキル

## 目的

ユニットテスト（Jest）・型チェック・リントを実行し、結果をレポートしてコミット可否を判定するスキル。E2E テストはユーザーが明示的に要求した場合のみ実行する。

---

## 実行手順（この順番を厳守すること）

### Step 1｜実行スコープを決定する

| 条件 | 実行内容 |
|------|---------|
| 明示的な指定なし（デフォルト） | ユニットテスト + 型チェック + リント |
| 「E2Eも含めて」と指定あり | 上記 + E2E テスト |
| 「特定ファイルのみ」と指定あり | 対象ファイルのみ実行 |

---

### Step 2｜ユニットテストを実行する（Jest）

```bash
# デフォルト: 全テスト実行
bun run test

# 特定ファイルのみ
bun run test -- --testPathPattern=<pattern>

# カバレッジ詳細が必要な場合
bun run test -- --coverage
```

出力から以下を抽出する：

- テスト総数・成功数・失敗数・スキップ数
- カバレッジ（Statements / Branches / Functions / Lines）
- 失敗テストのファイル名・テスト名・エラーメッセージ・行番号

---

### Step 3｜型チェックを実行する

```bash
bunx tsc --noEmit
```

エラーが検出された場合はファイル名・行番号・エラーメッセージを抽出する。

---

### Step 4｜リントを実行する

```bash
bun run lint
```

エラー・警告が検出された場合はルール名・ファイル名・行番号・メッセージを抽出する。

---

### Step 5｜E2E テストを実行する（要求された場合のみ）

```bash
# シードデータを確認・投入
ls -la tests/e2e/seed/seed-e2e.ts
bun run seed:e2e

# テスト実行
bunx playwright test

# 特定ブラウザのみ
bunx playwright test --project=chromium

# 特定ファイルのみ
bunx playwright test tests/e2e/<file>.spec.ts
```

---

### Step 6｜レポートを出力する

```markdown
## テスト実行結果

### ユニットテスト（Jest）
- 実行: [総数] tests
- 成功: [成功数] passed
- 失敗: [失敗数] failed
- スキップ: [スキップ数] skipped
- カバレッジ: Statements [%] / Branches [%] / Functions [%] / Lines [%]

### 失敗したテスト（失敗がある場合のみ）

#### 1. `src/queries/XXX.test.ts`

**テスト**: `describe名 > it名`
**エラー**:
Expected: { success: true, data: {...} }
Received: { success: false, error: "..." }

**推奨対応**:
1. `src/lib/schemas.ts` の `XXXSchema` を確認
2. `src/config/test-fixtures.ts` の `createTestXXX()` を確認

---

### 型チェック（TypeScript）
- ステータス: ✅ エラーなし / ❌ [N] errors

#### エラー詳細（エラーがある場合のみ）
1. `src/queries/XXX.ts:42:15`
   Type 'string | undefined' is not assignable to type 'string'.
   推奨対応: 型ガードまたは `??` を使用

---

### リント（ESLint）
- ステータス: ✅ エラー・警告なし / ⚠️ [N] warnings / ❌ [N] errors

#### 詳細（エラー・警告がある場合のみ）
1. `src/components/store/XXX.tsx:28:10`
   ルール: `@next/next/no-img-element`
   推奨対応: `<img>` を `<Image />` に置き換え

---

### E2E テスト（Playwright）（実行した場合のみ）
- 実行: [総数] tests (Chromium: N, Firefox: N, WebKit: N)
- 成功: [成功数] passed
- 失敗: [失敗数] failed
- 所要時間: [秒]s

---

### コミット判定

✅ コミット可能 — 全テスト成功・型エラーなし・リントエラーなし
⚠️ 条件付きコミット可能 — 警告のみ（エラーなし）
❌ コミット不可 — テスト失敗 / 型エラー / リントエラーあり
```

---

### Step 7｜次のアクションを提案する

#### テスト失敗・エラーあり

```markdown
## 次のアクション（必須・コミット前に修正）

- [ ] `src/queries/XXX.test.ts` の失敗テストを修正
- [ ] `src/queries/XXX.ts:42` の型エラーを修正

## 次のアクション（推奨）

- [ ] カバレッジ 80% 未満の箇所にテストを追加
  - `src/queries/coupon.ts`: 65.3%
  - `src/queries/offer-tag.ts`: 72.1%
- [ ] ESLint 警告を修正
```

#### 全テスト成功

```markdown
## 次のアクション

✅ 全テスト成功、コミット可能です

- [ ] カバレッジ 80% 未満の箇所があればテスト追加を検討
- [ ] `git add . && git commit -m "feat: ..."`
```

---

## 重要ルール

### ❌ 絶対禁止

- `it.skip()` / `it.only()` のコミット（デバッグ時の一時使用は可、コミット前に必ず削除）
- `// @ts-ignore` による型エラーの無視（`@ts-expect-error` + 理由コメントに限り許容）
- デバッグ用 `console.log()` のコミット

### ✅ 必須

- コミット前にユニットテスト・型チェック・リントを実行する
- テスト失敗・型エラー・リントエラーがある場合はコミットしない
- 新しいコードにはテストを追加し、カバレッジ 80% 以上を維持する

### 💡 推奨

- テストは AAA パターン（Arrange / Act / Assert）で記述する
- テスト名は「正常ケース: [内容]」「異常ケース: [内容]」の形式にする
- E2E テストは UI 変更やワークフロー変更時のみ実行する（実行時間が長いため）

---

## 参考: 主要コマンド

```bash
# ユニットテスト
bun run test                                                      # 全テスト
bun run test -- --testPathPattern=src/queries/XXX.test.ts        # 特定ファイル
bun run test -- --coverage                                        # カバレッジ付き
bun run test:watch                                                # ウォッチモード
bun run test -- --onlyChanged                                     # 変更ファイルのみ

# E2E テスト
bunx playwright test                                              # 全テスト
bunx playwright test --project=chromium                          # 特定ブラウザ
bunx playwright test tests/e2e/cart-smoke.spec.ts                # 特定ファイル
bunx playwright test --ui                                         # UI モード
bun run seed:e2e                                                  # シードデータ投入

# 型チェック・リント
bunx tsc --noEmit                  TypeScript 型チェック
bun run lint                       ESLint
bun run lint --fix                 ESLint 自動修正
bunx prettier --check .            Prettier チェック
bunx prettier --write <file>       Prettier 自動修正

# Prisma
bunx prisma generate               クライアント再生成
bunx prisma validate               スキーマ検証
bunx prisma studio                 DB ブラウザ
```

---

## 参考: 主要ファイルパス

```
# テスト設定
jest.config.js                     Jest 設定
playwright.config.ts               Playwright 設定
tests-setup/jest.setup.ts          Jest セットアップ

# テストファイル
src/queries/*.test.ts              ユニットテスト
tests/e2e/*.spec.ts                E2E テスト
tests/e2e/seed/seed-e2e.ts        E2E シードデータ

# テスト共通インフラ
src/config/test-fixtures.ts        テストファクトリ
src/config/test-helpers.ts         テストヘルパー
src/config/test-scenarios.ts       テストシナリオ
src/config/test-config.ts          テスト定数

# ビルド設定
package.json                       テストスクリプト定義
tsconfig.json                      TypeScript 設定
.eslintrc.json                     ESLint 設定
```
