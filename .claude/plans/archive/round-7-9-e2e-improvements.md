# Documentation Update - Round 10

## Context

Round 5-9 での一連の改善（E2E テスト、配送料計算、エラーハンドリング、コンポーネントテスト）が完了しました。これらの変更内容をドキュメントに反映する必要があります。

ドキュメントが更新されていない期間があったため、厳密な確認とステップバイステップのコミットを行いながら更新作業を進めます。

### 最近の主要な変更（Round 5-9）

1. **E2E テスト改善**:
   - サイズ選択ステップの追加（Round 7: 直接テスト、Round 8: ヘルパー関数）
   - 環境変数処理の改善（Round 9: 空文字列・空白の適切な処理）
   - テストヘルパー関数の導入（`addItemToCart`）

2. **配送料計算の改善**:
   - 中央集約化された計算ロジック（`src/lib/shipping-utils.ts`）
   - コンポーネントでの一貫した使用パターン
   - 条件分岐ロジックの修正

3. **エラーハンドリングの統一**:
   - サーバーアクションでの一貫したエラーハンドリング（`product.ts`）
   - 構造化ログ形式の適用

4. **コンポーネントテストの追加**:
   - `ProductShippingFee` コンポーネントのテスト
   - 各配送方式（ITEM, WEIGHT, FIXED）のカバレッジ

### ドキュメント更新の必要性

- 新しいテストパターンの文書化
- 改善された実装パターンの反映
- アーキテクチャ決定の記録
- テストインフラストラクチャの更新説明

---

## 更新対象ドキュメント

探索結果に基づき、以下のドキュメントを段階的に更新します:

### Phase 1: テスト設計ドキュメント（最優先）

1. **`docs/testing/TESTING_DESIGN.md`**
   - E2E テストヘルパー関数パターンの追加
   - 環境変数処理のベストプラクティス記載
   - サイズ選択ステップの標準化

2. **`docs/testing/TEST_IMPLEMENTATION_PLAN.md`**
   - 完了したテスト実装の記録
   - `ProductShippingFee` テスト完了ステータス更新
   - E2E 購入フローテストの改善点記録

### Phase 2: アーキテクチャと品質ドキュメント

3. **`.claude/steering/tech.md`**
   - 配送料計算の中央集約パターン追加
   - エラーハンドリング統一パターンの記録
   - リエントランシーガード実装例の追加

4. **`specs/multi-vendor-ecommerce/06-quality.md`**
   - 配送料計算の精度保証に関する記述
   - サーバーアクションエラーハンドリングの品質基準

5. **`specs/multi-vendor-ecommerce/07-testing.md`**
   - E2E テスト改善の概要追加
   - ヘルパー関数パターンの文書化

### Phase 3: 履歴とアーカイブ

6. **プランファイルのアーカイブ**
   - Round 7-9 のプランを適切にアーカイブ
   - 変更履歴として保存

---

## 更新計画の詳細

### Step 1: TESTING_DESIGN.md の更新

**File**: `docs/testing/TESTING_DESIGN.md`

**更新内容**:
1. **E2E ヘルパー関数パターン** セクションを追加（L140 付近、E2E Seed Strategy の後）
   - `addItemToCart` ヘルパー関数の実装例
   - サイズ選択ステップの標準化
   - URL パラメータ待機パターン

2. **環境変数処理** セクションを更新（L110-140 の Seed Strategy 内）
   - 空文字列・空白の適切な処理方法
   - trim と条件分岐のベストプラクティス
   - 数値変換時の注意事項

**コミットメッセージ**: `docs(testing): add E2E helper patterns and env var handling best practices`

### Step 2: TEST_IMPLEMENTATION_PLAN.md の更新

**File**: `docs/testing/TEST_IMPLEMENTATION_PLAN.md`

**更新内容**:
1. **Phase 2 完了状況の更新** (L550-575 `ProductShippingFee` セクション)
   - テスト実装済みステータスに変更
   - 実装済みテストケース数: 12/12
   - 完了日と関連コミットへの参照を追加

2. **Phase 3 E2E テスト** の改善点記録 (L683-805)
   - Purchase Flow テストの強化（サイズ選択ステップ追加）
   - ヘルパー関数導入による DRY 化
   - 環境変数処理の改善

**コミットメッセージ**: `docs(testing): update test implementation status for completed components`

### Step 3: tech.md の更新

**File**: `.claude/steering/tech.md`

**更新内容**:
1. **コーディング規約** テーブルに新規パターン追加（L25-40 付近）
   - **配送料計算**: `computeShippingTotal` による中央集約を必須とする
   - **リエントランシーガード**: 非同期操作での多重実行防止パターン
   - **環境変数処理**: 数値変換時の trim と fallback パターン

2. **実装例** セクションを追加
   ```typescript
   // 配送料計算の中央集約例
   import { computeShippingTotal } from "@/lib/shipping-utils";
   const total = computeShippingTotal(method, fee, extraFee, weight, quantity);

   // リエントランシーガード例（newsletter.tsx 参照）
   const isSubmittingRef = useRef(false);
   if (isSubmittingRef.current) return;
   isSubmittingRef.current = true;
   ```

**コミットメッセージ**: `docs(tech): add centralized patterns for shipping calculation and reentrancy guard`

### Step 4: quality.md の更新

**File**: `specs/multi-vendor-ecommerce/06-quality.md`

**更新内容**:
1. **Performance** セクションに配送料計算の精度保証を追加
   - `Math.round` と `Number.EPSILON` による浮動小数点誤差補正
   - 2桁精度の保証

2. **Error Handling** セクションにサーバーアクション品質基準を追加
   - 全サーバーアクションでの `try/catch` 必須化
   - 構造化ログ形式 `[Module:Function]` の統一

**コミットメッセージ**: `docs(specs): document shipping calculation precision and error handling standards`

### Step 5: testing.md の更新

**File**: `specs/multi-vendor-ecommerce/07-testing.md`

**更新内容**:
1. **E2E Testing** セクションを拡張（現在 71 行と簡潔なため）
   - ヘルパー関数パターンの導入
   - サイズ選択の標準化アプローチ
   - 環境変数テストの堅牢性向上

2. **Component Testing** セクションに実装例追加
   - `ProductShippingFee` の各配送方式テスト
   - `computeShippingTotal` のユニットテスト

**コミットメッセージ**: `docs(specs): expand E2E and component testing sections with recent improvements`

### Step 6: プランファイルのアーカイブ

**Actions**:
1. `.claude/plans/archive/` ディレクトリを作成（存在しない場合）
2. 現在の `polished-kindling-rain.md` を `round-7-9-e2e-improvements.md` としてアーカイブ
3. 各 Round の変更概要を含むインデックスファイル作成

**コミットメッセージ**: `docs(archive): archive Round 7-9 E2E improvement plans`

---

## 実装順序とコミット戦略

ドキュメント更新は以下の順序で実施し、各ステップ後に個別にコミットします:

### 実行順序

```
Step 1: TESTING_DESIGN.md 更新
  ↓ (検証・コミット)
Step 2: TEST_IMPLEMENTATION_PLAN.md 更新
  ↓ (検証・コミット)
Step 3: tech.md 更新
  ↓ (検証・コミット)
Step 4: quality.md 更新
  ↓ (検証・コミット)
Step 5: testing.md 更新
  ↓ (検証・コミット)
Step 6: プランファイルアーカイブ
  ↓ (検証・コミット)
最終確認
```

### 各ステップでの検証内容

**Step 1-5 共通検証**:
1. Markdown リント: `bunx markdownlint-cli2 <file>`
2. リンク切れチェック: 内部参照の整合性確認
3. コード例の構文チェック: TypeScript 構文の正確性
4. 用語の一貫性: 既存ドキュメントとの用語統一

**Step 6 追加検証**:
1. アーカイブファイルの可読性確認
2. インデックスファイルの完全性確認

---

## 更新対象ファイル

以下のファイルを順次更新します:

1. **[docs/testing/TESTING_DESIGN.md](../../../docs/testing/TESTING_DESIGN.md)** (265 lines)
   - Section: E2E Seed Strategy (L110-140 付近)
   - 新規追加: E2E Helper Patterns セクション

2. **[docs/testing/TEST_IMPLEMENTATION_PLAN.md](../../../docs/testing/TEST_IMPLEMENTATION_PLAN.md)** (853 lines)
   - Section: Phase 2 - Store Components (L550-575)
   - Section: Phase 3 - E2E Suites (L683-805)

3. **[.claude/steering/tech.md](../../../.claude/steering/tech.md)** (Tech Constraints)
   - Section: コーディング規約 (L25-40 付近)
   - 新規追加: 実装例セクション

4. **[specs/multi-vendor-ecommerce/06-quality.md](../../../specs/multi-vendor-ecommerce/06-quality.md)**
   - Section: Performance
   - Section: Error Handling

5. **[specs/multi-vendor-ecommerce/07-testing.md](../../../specs/multi-vendor-ecommerce/07-testing.md)** (71 lines)
   - Section: E2E Testing
   - Section: Component Testing

6. **Archive Operations**:
   - Create: `.claude/plans/archive/` (if not exists)
   - Move: `polished-kindling-rain.md` → `archive/round-7-9-e2e-improvements.md`
   - Create: `archive/INDEX.md`

---

## 期待される成果

### ドキュメント品質の向上

1. **最新性**: Round 5-9 の全変更がドキュメントに反映される
2. **一貫性**: 実装とドキュメントの齟齬が解消される
3. **参照性**: 新しいパターンが明確に文書化され、再利用可能になる
4. **履歴管理**: 変更履歴がアーカイブとして保存される

### 開発者体験の改善

- ✅ **E2E テストパターン**: 標準化されたヘルパー関数の使用方法が明確
- ✅ **配送料計算**: 中央集約パターンによる実装の統一性
- ✅ **エラーハンドリング**: 一貫した実装パターンの文書化
- ✅ **環境変数処理**: ベストプラクティスの明示化

### コード品質の維持

- ✅ **実装パターンの標準化**: ドキュメント化により新規開発でも同じパターンを適用可能
- ✅ **テストカバレッジの可視化**: 完了したテストが明確に記録される
- ✅ **技術的負債の削減**: 改善されたパターンが将来の開発指針となる

---

## 詳細な変更内容

### Step 1: TESTING_DESIGN.md

**追加セクション** (L140 付近):

```markdown
### E2E Helper Function Patterns

E2E テストでは再利用可能なヘルパー関数を作成することで、テストコードの DRY 化と保守性向上を図ります。

#### Size Selection Helper Example

商品詳細ページでのサイズ選択は、以下のパターンで実装します:

\`\`\`typescript
// Select the first available size
const firstSize = page.locator('[data-testid^="size-option-"]').first();
await firstSize.click();

// Wait for URL to update with size parameter
await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
\`\`\`

このパターンは以下を保証します:
- サイズボタンの適切な選択
- URL パラメータの更新待機
- タイムアウト時の明確なエラー

#### Environment Variable Handling

数値型環境変数の処理では、空文字列や空白の適切な処理が必要です:

\`\`\`typescript
// Trim and validate before conversion
const envPrice = process.env.E2E_UNIT_PRICE?.trim();
unitPrice = envPrice ? Number(envPrice) : fallbackValue;
if (!Number.isFinite(unitPrice)) {
  throw new Error(\`Invalid value: \${process.env.E2E_UNIT_PRICE}\`);
}
\`\`\`

**Key Points**:
- `trim()` で前後の空白を除去
- 空文字列は falsy として扱い、fallback を使用
- `Number.isFinite()` で無効な値を検出
```

**更新セクション** (L110-140):

E2E Seed Strategy セクションに環境変数のベストプラクティスを追加。

### Step 2: TEST_IMPLEMENTATION_PLAN.md

**更新箇所 1** (L550-575):

```markdown
#### ProductShippingFee Component

**Status**: ✅ Completed (2026-03-23)

**Implementation**: `tests/component/store/shipping-fee.test.tsx`

**Test Cases Implemented** (12/12):
- ✅ ITEM method: Basic rendering
- ✅ ITEM method: Tiered pricing (fee ≠ extraFee)
- ✅ ITEM method: Flat pricing (fee === extraFee)
- ✅ ITEM method: Single quantity formula
- ✅ WEIGHT method: Basic rendering
- ✅ WEIGHT method: Calculation accuracy
- ✅ FIXED method: Basic rendering
- ✅ FIXED method: Quantity independence
- ✅ Edge case: Unknown method returns null
- ✅ Edge case: Zero quantity
- ✅ Centralized calculation via `computeShippingTotal`
- ✅ Floating-point precision handling

**Related Files**:
- Component: `src/components/store/product-page/shipping/shipping-fee.tsx`
- Utility: `src/lib/shipping-utils.ts`
- Test: `tests/component/store/shipping-fee.test.tsx`

**Commits**:
- [Commit SHA] refactor(store): centralize shipping calculation
- [Commit SHA] test(component): add ProductShippingFee tests
```

**更新箇所 2** (L683-805):

Phase 3 E2E Suites の Purchase Flow セクションに改善点を記録:

```markdown
**Recent Improvements** (2026-03-23):
- ✅ Size selection steps added to all tests
- ✅ Helper function `addItemToCart` introduced for DRY
- ✅ Environment variable handling improved (trim + fallback)
- ✅ URL parameter validation patterns established

**Implementation Details**:
- File: `tests/e2e/purchase-flow.spec.ts`
- Helper pattern ensures consistent size selection across tests
- Environment variables support empty string fallback
```

### Step 3: tech.md

**追加コンテンツ** (コーディング規約テーブル後):

```markdown
## 実装パターン例

### 配送料計算の中央集約

すべての配送料計算は `src/lib/shipping-utils.ts` の `computeShippingTotal` を使用します:

\`\`\`typescript
import { computeShippingTotal } from "@/lib/shipping-utils";
import { ShippingFeeMethod } from "@prisma/client";

const total = computeShippingTotal(
  method,        // ShippingFeeMethod: "ITEM" | "WEIGHT" | "FIXED"
  fee,           // 基本配送料
  extraFee,      // 追加配送料（ITEM 方式）
  weight,        // 商品重量（WEIGHT 方式）
  quantity       // 商品数量
);
\`\`\`

**利点**:
- 計算ロジックの一元管理
- 浮動小数点誤差の統一的な補正
- テスト容易性の向上

### リエントランシーガード

非同期操作での多重実行を防ぐパターン:

\`\`\`typescript
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
\`\`\`

**実装例**: `src/components/store/layout/footer/newsletter.tsx`

### 環境変数の数値変換

空文字列や空白を適切に処理する:

\`\`\`typescript
const envValue = process.env.MY_NUMBER?.trim();
const myNumber = envValue ? Number(envValue) : defaultValue;

if (!Number.isFinite(myNumber)) {
  throw new Error(\`Invalid MY_NUMBER: \${process.env.MY_NUMBER}\`);
}
\`\`\`
```

### Step 4-6 の詳細は同様の形式で記載

各ステップで具体的な追加・更新内容を明示します。

---

## 検証手順

各ステップ完了後に以下の検証を実施します:

### ステップ完了時の検証

**1. Markdown リントチェック**

```bash
bunx markdownlint-cli2 <updated-file>
```

**期待結果**: エラー・警告なし（または許容可能な警告のみ）

**2. リンク整合性チェック**

各ドキュメント内の内部参照をマニュアルで確認:
- ファイルパスが正しいか
- セクション参照が有効か
- コード例のファイルパスが実在するか

**3. コード例の構文チェック**

TypeScript コードブロックを抜き出して構文確認:
- 型エラーがないか
- import 文が正しいか
- 実際のコードと整合性があるか

**4. 用語の一貫性確認**

- 既存ドキュメントとの用語統一
- 日英表記の一貫性
- 技術用語の正確性

### 最終検証（全ステップ完了後）

**1. ドキュメント相互参照の確認**

```bash
# すべての markdown ファイルをチェック
find docs .claude specs -name "*.md" -exec grep -l "TESTING_DESIGN\|TEST_IMPLEMENTATION\|tech.md\|quality.md\|testing.md" {} \;
```

相互参照が正しく機能していることを確認。

**2. Git ステータスの確認**

```bash
git status
git log --oneline -10
```

**期待結果**:
- 6つの個別コミットが作成されている
- 各コミットメッセージが規約に準拠
- 変更されたファイルが意図通り

**3. ドキュメント全体の通読**

更新された全ドキュメントを通読し、以下を確認:
- 文脈の一貫性
- 情報の最新性
- 読みやすさ

**4. テストスイートの実行**

```bash
bun run test
```

**期待結果**: 既存テストが全て pass（ドキュメント更新はテストに影響しない）

---

## 重要な注意事項

### 段階的コミットの重要性

- **各ステップ後に必ずコミット**: ロールバックが容易になり、レビューも明確
- **コミットメッセージの規約遵守**: Conventional Commits 形式（`docs(scope): description`）
- **変更の原子性**: 各コミットは独立した論理的な変更単位

### ドキュメント更新のベストプラクティス

1. **既存内容の尊重**: 不必要な削除や大幅な書き換えは避ける
2. **具体例の追加**: 抽象的な説明だけでなく、コード例を含める
3. **参照の明示**: 関連ファイルや実装箇所への明確なリンク
4. **日付の記録**: 更新日や完了日を明記（トレーサビリティ向上）

### リスクと緩和策

**リスク 1**: ドキュメント量が多く、更新漏れの可能性

**緩和策**:
- 探索結果に基づく明確な対象ファイルリスト
- 各ステップでのチェックリスト使用
- 最終検証での相互参照確認

**リスク 2**: コード例の陳腐化

**緩和策**:
- 実際のコードから直接コピー
- ファイルパスと行番号の明示
- 将来の変更時に grep で検索可能な形式

**リスク 3**: 用語の不統一

**緩和策**:
- 既存ドキュメントの用語を優先
- 技術用語は初出時に定義
- 略語は展開形も併記

### タイムライン予想

- Step 1-2 (テスト設計): 各30-45分 → 1-1.5時間
- Step 3 (tech.md): 20-30分
- Step 4-5 (specs): 各15-20分 → 30-40分
- Step 6 (アーカイブ): 15-20分
- 検証・最終確認: 30分

**合計**: 約2.5-3時間

### 完了後の次ステップ

1. **チームレビュー依頼**: ドキュメント更新のレビュー
2. **CI/CD 更新**: 必要に応じてドキュメントリントの追加
3. **定期的な見直し**: 四半期ごとのドキュメント鮮度確認

---

## まとめ

このプランでは、Round 5-9 で実施した技術的改善を6つの段階に分けてドキュメントに反映します。各段階で個別にコミットを行うことで、変更履歴を明確に保ち、必要に応じて個別の変更をロールバック可能にします。

**主要な更新対象**:
- テスト設計とストラテジー（最優先）
- 技術的制約とパターン
- 品質基準とテスト戦略
- 履歴アーカイブ

**期待される効果**:
- 実装とドキュメントの一致
- 新規開発者の参照資料の充実
- 技術的負債の可視化と削減
- プロジェクトの保守性向上
