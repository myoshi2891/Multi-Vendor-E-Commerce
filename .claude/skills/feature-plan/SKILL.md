---
name: feature-plan
description: >
  Generates a comprehensive implementation plan before any new feature development begins.
  Reads all relevant spec files, analyzes existing patterns, and presents a structured
  plan for user approval. Must be triggered BEFORE writing any code.
  Triggered by: "新機能実装", "機能追加", "新しい機能", "実装計画",
  "feature追加", "implementation plan", "add feature", "new feature",
  "plan this feature", "機能を追加したい", "追加してほしい".
invocation: automatic
allowed-tools: [Read, Grep, Bash]
---

# Feature Implementation Plan スキル

## 目的

`.agent/rules/core.md` の原則「コードを一行も書く前に Implementation Plan を生成し、ユーザーの承認を得る」を実行するスキル。

---

## 実行手順（この順番を厳守すること）

### Step 1｜仕様書を読み込む

以下の順番で仕様書を読み込み、プロジェクト全体像と制約を把握する。

```
Read: specs/multi-vendor-ecommerce/00-overview.md   → プロダクト目的・ペルソナ確認
Read: specs/multi-vendor-ecommerce/01-requirements.md → 機能・非機能要件との整合性確認
Read: specs/multi-vendor-ecommerce/02-architecture.md → 技術スタック・禁止事項の確認
Read: specs/multi-vendor-ecommerce/03-data-model.md  → 既存エンティティ・リレーション確認
```

必要に応じて追加で読み込む：

```
Read: specs/multi-vendor-ecommerce/04-interfaces.md  → API・UI定義
Read: specs/multi-vendor-ecommerce/05-workflows.md   → ユーザーフロー
Read: specs/multi-vendor-ecommerce/07-testing.md     → テスト方針
Read: specs/multi-vendor-ecommerce/08-open-questions.md → 未解決事項
Read: specs/001-sample-feature/plan.md               → 計画書テンプレート確認
```

確認すべきポイント：

- 対象ペルソナ（USER / SELLER / ADMIN）の特定
- 現フェーズのスコープ外でないか
- 禁止技術（`any` 型、`db push` 等）への抵触がないか

---

### Step 2｜既存パターンを調査する

類似実装を探し、再利用できるパターンを特定する。

```bash
# サーバーアクションの調査
grep -r "export async function" src/queries/

# UIコンポーネントの調査
find src/components -name "*.tsx" | head -20
```

```
Read: src/lib/schemas.ts        → 再利用可能なZodスキーマの確認
Read: src/config/test-fixtures.ts → テストファクトリの確認
Read: src/config/test-helpers.ts  → テストヘルパーの確認
```

---

### Step 3｜計画書を生成する

`specs/001-sample-feature/plan.md` のフォーマットに従い、以下の構成で生成する：

```markdown
# Implementation Plan: [機能名]

## 1. Architecture / Approach
- 機能の目的・ユーザー価値
- 採用アプローチと技術選定理由
- アーキテクチャパターン（サーバーアクション集約・3層設計）への適合

## 2. Scope of Change

### 新規作成
- `src/queries/XXX.ts`
- `src/queries/XXX.test.ts`
- `src/app/(store)/XXX/page.tsx`（UI変更がある場合）
- `src/components/store/XXX.tsx`（UI変更がある場合）

### 既存ファイルの変更
- `src/lib/schemas.ts` — Zodスキーマ追加
- `prisma/schema.prisma` — データモデル変更（必要な場合）

## 3. Data Model（スキーマ変更がある場合のみ）

```prisma
model XXX {
  id        String   @id @default(uuid())
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
}
```

マイグレーション名: `add_xxx_model`
破壊的操作: なし / あり（詳細）
ロールバック計画: ...

## 4. API / Interfaces

#### createXXX
- シグネチャ: `async function createXXX(data: z.infer<typeof XXXSchema>)`
- 認証: 必須（USER以上）
- バリデーション: `XXXSchema`
- DB操作: `db.xxx.create()`
- エラーケース: 未認証 / バリデーションエラー / DBエラー

## 5. UI / Components（UI変更がある場合のみ）
- ページパス・ロール・レイアウト継承
- 新規コンポーネント一覧

## 6. Testing Plan

### ユニットテスト（Jest）
テストケース（AAAパターン）:
1. createXXX — 正常・未認証・バリデーションエラー
2. getXXXList — 正常・未認証
3. updateXXX — 正常・他人のデータは更新不可
4. deleteXXX — 正常・他人のデータは削除不可

カバレッジ目標: Statement 80% / Branch 75% / Function 80%

### E2Eテスト（Playwright）（UI変更がある場合のみ）
1. XXX作成フロー
2. XXX一覧表示
3. XXX更新・削除

## 7. Rollout / Release

1. ユニットテスト: `bun run test`
2. 型チェック: `bunx tsc --noEmit`
3. リント: `bun run lint`
4. マイグレーション（必要な場合）:
   `bunx prisma migrate dev --name add_xxx_model`
   `bunx prisma generate`
5. E2Eテスト: `bunx playwright test`
6. 仕様書更新（変更があったセクションのみ）
7. コミット: `git commit -m "feat: XXX機能を追加"`

ロールバック計画（破壊的変更がある場合のみ）: ...

## 8. Risk Analysis
- 破壊的変更: ✅ なし / ⚠️ あり（詳細）
- 既存機能への影響: なし / あり（詳細）
- パフォーマンス影響: なし / あり（インデックス追加の必要性）
- セキュリティリスク: 認証・認可・XSS・SQLインジェクション対策

## 9. Open Questions（未解決事項があれば）
- [ ] XXX の仕様詳細（要確認）

## 10. Next Steps（承認後の実装順序）
1. DBスキーマ変更（必要な場合）
2. サーバーアクション実装
3. ユニットテスト実装
4. UIコンポーネント実装（必要な場合）
5. E2Eテスト実装（必要な場合）
6. 仕様書更新
7. コミット・プッシュ

```

---

### Step 4｜ユーザーの承認を得る

計画書の提示後、**必ず以下の確認メッセージを表示し、明示的な承認を待つ**：

```

## ✅ 実装計画の確認

上記の計画で「[機能名]」の実装を進めてよろしいですか？

確認ポイント：
1. スコープ — 変更対象ファイル・影響範囲は適切か
2. アプローチ — 技術選定・設計パターンは適切か
3. リスク — 破壊的変更・既存機能への影響は許容範囲か
4. テスト — テスト計画は十分か

👉 承認する場合: 「承認」または「OK」とお答えください
👉 変更が必要な場合: 修正内容をお知らせください

```

**「承認」「OK」の明示的な返答があるまで、実装を一切開始しない。**

---

## 重要ルール

### ✅ 必須

- ユーザー承認なしに実装を開始しない
- 仕様書を読んでから計画を立てる（仕様書が単一の真実のソース）
- 既存パターンを調査し、再利用できる部分を特定する
- リスク分析（破壊的変更・セキュリティ・パフォーマンス）を必ず含める
- `08-open-questions.md` に関連事項があれば計画書に含める

### ❌ 禁止

- 承認なしに実装を開始すること
- 仕様書を読まずに計画を立てること
- 計画書に具体的なコード実装を含めること（方向性の提示に留める）

### 💡 推奨

- 大きな機能は複数フェーズに分割し、MVP を優先する
- テストケースは「正常・異常・権限エラー」の3軸で考える
- 仕様書のどのセクションを更新すべきか明記する

---

## 参考: 主要ファイルパス

```

## 仕様書
specs/multi-vendor-ecommerce/
  00-overview.md       プロダクト概要
  01-requirements.md   機能・非機能要件
  02-architecture.md   アーキテクチャ制約
  03-data-model.md     データモデル仕様
  04-interfaces.md     API・UI定義
  05-workflows.md      ユーザーフロー
  07-testing.md        テスト方針
  08-open-questions.md 未解決事項
specs/001-sample-feature/plan.md  計画書テンプレート

## 実装
src/queries/*.ts        サーバーアクション
src/lib/schemas.ts      Zodスキーマ
src/lib/types.ts        型定義
prisma/schema.prisma    データモデル定義

## ルール
.agent/rules/core.md    実装前計画必須ルール
CLAUDE.md               プロジェクト設定

```
