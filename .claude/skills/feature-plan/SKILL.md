---
name: feature-plan
description: >
  新機能実装の計画を生成する。
  「新機能実装」「implementation plan」「機能追加」「feature追加」
  「新しい機能」「実装計画」などのキーワードで使用。
  仕様確認からテスト計画まで包括的に設計し、ユーザー承認を得る。
invocation: automatic
allowed-tools: [Read, Grep, Bash]
---

# Feature Implementation Plan

## 目的

新機能実装の計画書を生成し、ユーザーの承認を得る。

`.agent/rules/core.md` で「コードを一行も書く前に Implementation Plan を生成し、ユーザーの承認を得る」と明記されています。このスキルは、仕様確認から実装手順、テスト計画、リリース手順までを包括的に設計します。

## トリガー条件

以下の場合に自動的に実行されます：

- ユーザーが「新機能実装」「implementation plan」「機能追加」と言った場合
- 「feature追加」「新しい機能」「実装計画」などの表現を使った場合
- 具体的な機能名とともに実装を依頼された場合

## 実行手順

### 1. 仕様確認（必須順序）

以下の仕様書を順番に読み込み、プロジェクトの全体像と制約を把握します：

#### A. プロダクトスコープ確認

```
Read tool: specs/multi-vendor-ecommerce/00-overview.md
```

- プロダクトの目的・機能概要を確認
- ペルソナ（USER, SELLER, ADMIN）のうち、どのロールが対象か確認
- スコープ外（現フェーズでは実装しない機能）に該当しないか確認

#### B. 機能・非機能要件確認

```
Read tool: specs/multi-vendor-ecommerce/01-requirements.md
```

- 既存の機能要件との整合性を確認
- Acceptance Criteria（受け入れ基準）のパターンを学習
- 非機能要件（パフォーマンス、セキュリティ）への影響を確認

#### C. アーキテクチャ制約確認

```
Read tool: specs/multi-vendor-ecommerce/02-architecture.md
```

- 技術スタック（Next.js 14, TypeScript, Prisma, Clerk等）の制約を確認
- 禁止事項（`any` 型、`db push` など）を確認
- アーキテクチャパターン（サーバーアクション集約、3層設計）を確認

#### D. データモデル確認

```
Read tool: specs/multi-vendor-ecommerce/03-data-model.md
```

- 既存のエンティティ定義を確認
- リレーション（1:N, N:M）の設計パターンを学習
- 新機能に必要なモデル・フィールドを検討

#### E. その他の仕様書（必要に応じて）

```
Read tool: specs/multi-vendor-ecommerce/04-interfaces.md  # API・UI定義
Read tool: specs/multi-vendor-ecommerce/05-workflows.md   # ユーザーフロー
Read tool: specs/multi-vendor-ecommerce/07-testing.md     # テスト方針
Read tool: specs/multi-vendor-ecommerce/08-open-questions.md  # 未解決事項
```

#### F. サンプル計画書の確認

```
Read tool: specs/001-sample-feature/plan.md
```

計画書のテンプレート・フォーマットを確認。

### 2. 既存パターンの調査

類似機能の実装を検索し、再利用可能なコンポーネント・パターンを特定：

#### A. サーバーアクションの調査

```bash
grep -r "export async function" src/queries/
```

- 類似したサーバーアクションが既に存在するか確認
- 認証・認可パターンを確認
- エラーハンドリングパターンを確認

#### B. UIコンポーネントの調査

```bash
find src/components -name "*.tsx" | head -20
```

- 再利用可能なUIコンポーネントを特定
- shadcn/ui コンポーネントの利用状況を確認

#### C. Zodスキーマの調査

```
Read tool: src/lib/schemas.ts
```

- 既存のバリデーションスキーマを確認
- 再利用可能なスキーマパーツを特定

#### D. テストパターンの調査

```
Read tool: src/config/test-fixtures.ts
Read tool: src/config/test-helpers.ts
```

- 利用可能なテストファクトリを確認
- テストシナリオのパターンを学習

### 3. 計画書生成

`specs/001-sample-feature/plan.md` のフォーマットに従って、以下の構成で計画書を生成：

#### 計画書の構成

```markdown
# Implementation Plan: [機能名]

## 1. Architecture / Approach

### 概要
- この機能の目的・ユーザー価値
- 採用するアプローチの概要

### 技術選定理由
- なぜこのアプローチを採用するか
- 代替案との比較（必要な場合）

### アーキテクチャパターン
- サーバーアクション集約設計への適合
- 3層設計（クライアント・サーバーアクション・データ）への配置

---

## 2. Scope of Change

### 変更対象ファイル

#### 新規作成
- `src/queries/XXX.ts` - サーバーアクション実装
- `src/queries/XXX.test.ts` - ユニットテスト
- `src/app/(store)/XXX/page.tsx` - UIページ（必要な場合）
- `src/components/store/XXX.tsx` - UIコンポーネント（必要な場合）

#### 既存ファイルの変更
- `src/lib/schemas.ts` - Zodスキーマ追加
- `src/lib/types.ts` - 型定義追加（必要な場合）
- `prisma/schema.prisma` - データモデル変更（必要な場合）

---

## 3. Data Model

（Prismaスキーマ変更が必要な場合のみ）

### 新規モデル

```prisma
model XXX {
  id        String   @id @default(uuid())
  userId    String
  fieldName String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
}
```

### 既存モデルの変更

（該当する場合のみ記述）

### マイグレーション計画

- マイグレーション名: `add_xxx_model`
- 破壊的操作: なし / あり（詳細を記述）
- ロールバック計画: ...

---

## 4. API / Interfaces

### サーバーアクション

#### createXXX

**シグネチャ**:

```typescript
export async function createXXX(
  data: z.infer<typeof XXXSchema>
): Promise<{ success: boolean; data?: XXX; error?: string }>
```

**認証**: 必須（USER以上）

**バリデーション**: `XXXSchema`

**DB操作**: `db.xxx.create()`

**エラーケース**:
- 未認証: "認証が必要です"
- バリデーションエラー: Zodのエラーメッセージ
- DB エラー: "作成に失敗しました"

#### その他のサーバーアクション

（getXXXList, updateXXX, deleteXXX など）

---

## 5. UI / Components

（UI変更が必要な場合のみ）

### 新規ページ

- **パス**: `/XXX`
- **ロール**: USER以上（認証必須）
- **レイアウト**: `src/app/(store)/layout.tsx` を継承

### 新規コンポーネント

- `src/components/store/XXXForm.tsx` - フォームコンポーネント
  - React Hook Form + Zod resolver
  - サーバーアクション呼び出し

- `src/components/store/XXXList.tsx` - 一覧表示コンポーネント

---

## 6. Testing Plan

### ユニットテスト（Jest）

#### テスト対象

- `src/queries/XXX.ts` の全サーバーアクション
- AAA パターン（Arrange-Act-Assert）
- 正常ケース・異常ケースの網羅

#### テストケース

1. **createXXX**
   - 正常ケース: データを作成できる
   - 異常ケース: 未認証の場合エラーを返す
   - 異常ケース: バリデーションエラーの場合エラーを返す

2. **getXXXList**
   - 正常ケース: ユーザーのXXX一覧を取得できる
   - 異常ケース: 未認証の場合エラーを返す

3. **updateXXX**
   - 正常ケース: 自分のデータを更新できる
   - 異常ケース: 他人のデータは更新できない

4. **deleteXXX**
   - 正常ケース: 自分のデータを削除できる
   - 異常ケース: 他人のデータは削除できない

#### カバレッジ目標

- ステートメント: 80%以上
- ブランチ: 75%以上
- 関数: 80%以上

### E2Eテスト（Playwright）

（UI変更がある場合のみ）

#### テストシナリオ

1. **XXX作成フロー**
   - ログイン → XXXフォーム表示 → 入力 → 送信 → 成功メッセージ表示

2. **XXX一覧表示**
   - ログイン → XXX一覧ページ表示 → データが表示されることを確認

3. **XXX更新・削除**
   - ログイン → XXX選択 → 編集 → 更新 → 削除

---

## 7. Rollout / Release

### リリース手順

1. **開発環境でのテスト**
   - ユニットテスト実行: `bun run test`
   - 型チェック: `bunx tsc --noEmit`
   - リント: `bun run lint`

2. **マイグレーション（必要な場合）**
   - `bunx prisma migrate dev --name add_xxx_model`
   - `bunx prisma generate`

3. **E2Eテスト実行**
   - シードデータ投入: `bun run seed:e2e`
   - テスト実行: `bunx playwright test`

4. **仕様書更新**
   - `specs/multi-vendor-ecommerce/03-data-model.md` 更新（DB変更がある場合）
   - `specs/multi-vendor-ecommerce/04-interfaces.md` 更新（API追加がある場合）

5. **コミット・プッシュ**
   - `git add .`
   - `git commit -m "feat: XXX機能を追加"`
   - `git push`

### ロールバック計画

（破壊的変更がある場合のみ）

- マイグレーションのロールバック方法
- データのバックアップ・リストア手順

---

## 8. Risk Analysis

### 破壊的変更の有無

- ✅ 破壊的変更なし / ⚠️ 破壊的変更あり（詳細を記述）

### 既存機能への影響

- 影響なし / 影響あり（詳細を記述）

### パフォーマンス影響

- 影響なし / 影響あり（詳細を記述）
- インデックス追加の必要性

### セキュリティリスク

- 認証・認可の実装
- 入力バリデーションの徹底
- SQLインジェクション、XSS等の対策

---

## 9. Open Questions

（未解決事項・議論が必要な点）

- [ ] XXX の仕様詳細（ユーザーに確認が必要）
- [ ] パフォーマンス最適化の優先度
- [ ] UIデザインの最終確認

---

## 10. Next Steps

### 承認後の実装順序

1. ✅ DBスキーマ変更（該当する場合）
2. ✅ サーバーアクション実装
3. ✅ ユニットテスト実装
4. ✅ UIコンポーネント実装（該当する場合）
5. ✅ E2Eテスト実装（該当する場合）
6. ✅ 仕様書更新
7. ✅ コミット・プッシュ

```

### 4. リスク分析

計画書に以下のリスク分析を含める：

#### A. 破壊的変更の有無

- DBスキーマの変更（DROP, ALTER ... DROP）
- 既存APIのシグネチャ変更
- ワークフローの変更

#### B. 既存機能への影響

- 関連する既存機能のリストアップ
- 影響範囲の特定
- 回帰テストの必要性

#### C. パフォーマンス影響

- 新しいDB クエリの追加
- インデックスの必要性
- N+1 クエリのリスク

#### D. セキュリティリスク

- 認証・認可の実装
- 入力バリデーションの徹底
- OWASP Top 10 への対策

### 5. ユーザー承認待ち

計画書を提示した後、**必ずユーザーの承認を得る**：

```

## 実装計画の確認

上記の計画で新機能「XXX」の実装を進めてよろしいですか？

以下の点を確認してください：

1. **スコープ**: 変更対象ファイル・影響範囲は適切か
2. **アプローチ**: 採用する技術選定・設計パターンは適切か
3. **リスク**: 破壊的変更・既存機能への影響は許容範囲か
4. **テスト**: テスト計画は十分か

承認いただける場合は「承認」または「OK」とお答えください。
変更が必要な場合は、具体的な修正内容をお知らせください。

```

**明示的な承認が得られるまで実装を開始しない**。

### 6. 未解決事項の確認

`specs/multi-vendor-ecommerce/08-open-questions.md` を確認し、新機能に関連する未解決事項があれば計画書に含める。

## 重要なルール（Critical Rules）

### 必須事項

1. **ユーザー承認なしに実装を開始しない**
   - 計画書を提示し、明示的な「承認」または「OK」を得る
   - 曖昧な返答（「たぶん」「多分」）では進まない

2. **仕様書との整合性を確認**
   - 新機能が `specs/multi-vendor-ecommerce/00-overview.md` のスコープ内か確認
   - 既存の仕様書との矛盾がないか確認

3. **既存パターンの再利用**
   - 類似した機能が既に存在する場合は、そのパターンを踏襲
   - 車輪の再発明を避ける

4. **リスク分析の徹底**
   - 破壊的変更、既存機能への影響、パフォーマンス影響を必ず分析
   - セキュリティリスクを見逃さない

5. **計画書のフォーマット統一**
   - `specs/001-sample-feature/plan.md` のテンプレートに従う
   - セクション構成を統一（Architecture, Scope, Data Model, API, Testing, Rollout）

### 禁止事項

1. **"Always Proceed" モード**
   - ユーザーの承認なしに実装を開始することは禁止
   - 「承認を待たずに進めてもいいですか？」という質問も禁止

2. **仕様書の無視**
   - 仕様書を読まずに計画を立てることは禁止
   - `.agent/rules/core.md` で「仕様書が単一の真実のソース」と明記

3. **過度に詳細な実装計画**
   - 計画書は実装の方向性を示すもの
   - 具体的なコード実装は計画書に含めない

4. **未解決事項の放置**
   - `08-open-questions.md` に関連事項があれば必ず確認
   - 未解決のまま実装を開始しない

### 推奨事項

1. **既存コードの調査を優先**
   - 計画を立てる前に、必ず既存の実装パターンを調査
   - 類似機能からコピー&カスタマイズできる部分を特定

2. **段階的な実装計画**
   - 大きな機能は複数のフェーズに分割
   - MVP（Minimum Viable Product）を優先

3. **テスト計画の具体化**
   - 抽象的な「テストを書く」ではなく、具体的なテストケースを列挙
   - カバレッジ目標を明確化

4. **ドキュメント更新の明記**
   - 仕様書のどのセクションを更新すべきか明記
   - README.md への影響も考慮

## 参考: 主要ファイルパス

### 仕様書

- `specs/multi-vendor-ecommerce/00-overview.md` - プロダクト概要
- `specs/multi-vendor-ecommerce/01-requirements.md` - 機能・非機能要件
- `specs/multi-vendor-ecommerce/02-architecture.md` - アーキテクチャ制約
- `specs/multi-vendor-ecommerce/03-data-model.md` - データモデル仕様
- `specs/multi-vendor-ecommerce/04-interfaces.md` - API・UI定義
- `specs/multi-vendor-ecommerce/05-workflows.md` - ユーザーフロー
- `specs/multi-vendor-ecommerce/07-testing.md` - テスト方針
- `specs/multi-vendor-ecommerce/08-open-questions.md` - 未解決事項
- `specs/001-sample-feature/plan.md` - 計画書テンプレート

### 実装

- `src/queries/*.ts` - サーバーアクション
- `src/lib/schemas.ts` - Zodスキーマ
- `src/lib/types.ts` - 型定義
- `prisma/schema.prisma` - データモデル定義

### ルール

- `.agent/rules/core.md` - 実装前計画必須ルール
- `CLAUDE.md` - プロジェクト概要

## 使用例

### 例1: ユーザーのお気に入り商品機能

```

ユーザー: 「新機能: ユーザーがお気に入り商品を保存できる機能を追加したい」

Claude:
（このスキルが自動実行される）

1. 仕様確認:
   - specs/multi-vendor-ecommerce/00-overview.md 読み込み
     → ペルソナ: USER が対象
   - specs/multi-vendor-ecommerce/01-requirements.md 読み込み
     → 既存の類似機能: カート、レビュー
   - specs/multi-vendor-ecommerce/03-data-model.md 読み込み
     → User, Product モデルを確認

2. 既存パターン調査:
   - src/queries/review.ts を読み込み
     → ユーザーと商品のリレーション実装パターンを学習

3. 計画書生成:
   ## Implementation Plan: ユーザーのお気に入り商品機能

   ## 1. Architecture / Approach
   - ユーザーが商品をお気に入りに追加・削除できる機能
   - N:M リレーション（User - Favorite - Product）

   ## 2. Scope of Change
   - 新規: src/queries/favorite.ts
   - 新規: src/queries/favorite.test.ts
   - 変更: prisma/schema.prisma (Favorite モデル追加)
   - 変更: src/lib/schemas.ts (FavoriteSchema 追加)

   ## 3. Data Model
   model Favorite {
     id        String   @id @default(uuid())
     userId    String
     productId String
     createdAt DateTime @default(now())

     user    User    @relation(fields: [userId], references: [id])
     product Product @relation(fields: [productId], references: [id])

     @@unique([userId, productId])
     @@index([userId])
   }

   （以下、API, Testing, Rollout の詳細）

4. リスク分析:
   - 破壊的変更: なし
   - 既存機能への影響: なし
   - パフォーマンス: インデックス追加で最適化

5. ユーザー承認待ち:
   「上記の計画で実装を進めてよろしいですか？」

```

### 例2: ストアフォロー機能

```

ユーザー: 「機能追加: ユーザーがストアをフォローできるようにしたい」

Claude:
1. 仕様確認

2. 既存パターン調査:
   - src/queries/store.ts を読み込み
   - src/queries/user.ts を読み込み

3. 計画書生成:
   ## Implementation Plan: ストアフォロー機能

   ### 1. Architecture / Approach
   - ユーザーがストアをフォロー・アンフォローできる機能
   - フォロー中のストアの新商品通知（将来拡張）

   ### 3. Data Model
   model StoreFollow {
     id        String   @id @default(uuid())
     userId    String
     storeId   String
     createdAt DateTime @default(now())

     user  User  @relation(fields: [userId], references: [id])
     store Store @relation(fields: [storeId], references: [id])

     @@unique([userId, storeId])
     @@index([userId])
     @@index([storeId])
   }

   （以下、詳細）

4. ユーザー承認待ち

```

## まとめ

このスキルは、新機能実装の品質とスコープを事前に保証します：

- ✅ 仕様書との整合性確認（SDD準拠）
- ✅ 既存パターンの再利用
- ✅ 包括的な実装計画（Architecture → Testing → Rollout）
- ✅ リスク分析の徹底
- ✅ ユーザー承認ガードレール

「コードを一行も書く前に Implementation Plan を生成」する原則を徹底し、計画的で高品質な機能追加をサポートします。
