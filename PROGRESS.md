# 進捗レポート (2025-12-21)

## ドキュメントガイド
- 本レポートは特定日付時点の進捗サマリ
- 関連: `README.md`, `docs/testing/TESTING_DESIGN.md`
- 追記は日付付きで末尾に追加する

## 範囲
- 基準コミット: `bc45c4f89da632eef8084ced9ddc33220ba1b63c`
- 対象: `bc45c4f89da632eef8084ced9ddc33220ba1b63c` 〜 `HEAD`

## 今日の対応サマリ
- Playwright導入（設定ファイル + 初回E2Eシナリオ）
- E2E安定化のための`data-testid`追加
- E2E seed（Prisma + `tsx`ランナー）整備
- Jestの`setupFilesAfterEnv`整理（`jest-dom` + MSW準備）
- シークレット取扱いルールを仕様書に明記、`.env`系の除外強化
- MSWの`server.ts`スキャフォールド追加
- `@playwright/test`追加、`bun run dev`に切替

## コミット一覧（新しい順）
- `bff57e4` Use tsx for E2E seed runner
- `2d0d90a` Add secret handling rules and ignore env files
- `45ab1a5` Add Playwright test dependency
- `6bf6361` Add MSW server scaffold
- `1966eae` Keep E2E seed example spacing
- `febfbaf` Use Bun for Playwright web server
- `59c39c2` Add Jest setup and ignore E2E tests
- `c36d3f5` Add E2E test selectors and seed script
- `2485e5f` Add Playwright config and cart smoke test
- `897be20` Jest/Playwright方針を`TESTING_DESIGN.md`に追記

## 実行ログ（要点）
- Seed:
  - `ts-node`はESM実行で失敗 → `tsx`に切替
  - MySQL起動: `brew services start mysql`
  - その後 `Unknown authentication plugin 'sha256_password'` で接続失敗
- E2E:
  - `bunx playwright test` は `webServer` 起動待ちタイムアウト
  - Clerkの環境変数は設定済み（値は出力・記録していない）

## 既知の課題
- DBの認証プラグインが`sha256_password`で、Prismaが接続できない
- `next dev` がPlaywrightの`webServer`起動待ちでタイムアウト

## 次アクション候補
- MySQLユーザーの認証方式を`mysql_native_password`または`caching_sha2_password`に変更
- `E2E_DATABASE_URL`を設定して `bun run seed:e2e` を再実行
- `bunx playwright test` を再実行（サーバー起動ログ確認）

## 付記
- シークレットは表示・コミットしていない
- テスト生成物はGit管理対象外とする方針

## 追記 (2025-12-21)
- KiloCode/Spec Kit の導入（`.kilocode/`, `.specify/`, `specs/` 雛形追加）
- 仕様書テンプレ整備とサンプル仕様の具体化（`specs/001-sample-feature`）
- 運用ルールと品質基準の明文化（`README_kilocode_speckit.md`, `constitution.md`）
- `.gitignore` に KiloCode/Spec Kit のキャッシュ除外を追加

## 追記 (2026-02-22)
- MySQL → PostgreSQL (Neon) 移行完了
- 接続方式: PostgreSQL (Neon) + Prisma Accelerate
- フルテキスト検索: tsvector/tsquery (`'simple'` トークナイザー) に移行済み
- ネイティブ外部キー制約が有効（`relationMode = "prisma"` → デフォルトの `"foreignKeys"`）
- `mysql2` ドライバ削除、`@prisma/extension-accelerate` 追加
- 全ドキュメントの MySQL 表記を PostgreSQL に更新

## 追記 (2026-03-01)

### ユニットテスト大量追加
- サーバーアクション全体のユニットテストを新規作成（536テスト、21スイート全パス）
- 対象モジュール: category, subCategory, offer-tag, review, profile, home, utils, schemas, cartStore, store, product, order, user, coupon, stripe, paypal, webhooks, setUserCountryInCookies
- テスト共通インフラを `src/config/` に整備:
  - `test-fixtures.ts`: 17ファクトリを `Partial<T>` 型安全パターンで統一
  - `test-helpers.ts`: モック認証・DB spy・console spy ユーティリティ
  - `test-scenarios.ts`: 相対日付ベースのシナリオデータ
  - `test-config.ts`: テスト共通定数（ID・URL・エラーメッセージ）

### 実装バグ修正（4件）
- `review.ts`: IDOR脆弱性修正（`upsert` → 所有権検証付き `update`/`create`）
- `webhooks/route.ts`: Svix検証済み `evt.data` を使用（`JSON.parse(body).data` の再パースを排除）
- `product.ts`: 配送料計算の `countryId` 比較バグ修正（`country.name` → `country.id`）
- `order.ts`: `updateOrderItemStatus` のエラーメッセージ修正

### テスト品質改善（18件）
- 共通インフラ: ファクトリ型安全化、JSDoc改善、ハードコード日付 → 相対日付
- 個別テスト: non-null assertion排除、spy復元のtry/finally化、空catch排除、fetchモック型安全化、mockDb二重定義解消、エラーメッセージアサーション追加 等14件
- テスト拡充: 16桁電話番号の境界値テスト、空バリアントのエッジケーステスト

### 仕様書更新
- `06-quality.md`: IDOR防止パターン、Svix検証済みデータ使用を追記
- `07-testing.md`: 共通テストインフラ (`src/config/`) を反映
- `08-open-questions.md`: Known Issues セクション新設
- `04-interfaces.md`: webhook・reviewモジュールのセキュリティパターンを追記

### ドキュメント整理
- `TESTING_DESIGN.md`, `QA_TEST_PERSPECTIVES.md` をルート → `docs/testing/` へ移動
- `CLAUDE.md`, `GEMINI.md` にテスト共通インフラの参照パスを追記
- `.claude/steering/structure.md` に `src/config/` ディレクトリを追加

### コミット一覧（新しい順）
- `8b25ca3` docs(specs): 実装変更に合わせて仕様書4件を更新
- `8614839` test(schemas,profile): 境界値・エッジケーステスト追加
- `babe77a` fix(test): 個別テスト品質改善14件
- `2a70003` refactor(test): テスト共通インフラ改善 (型安全化, 相対日付, JSDoc)
- `94c20a0` fix(api,queries): 実装バグ4件修正 (IDOR, Svix evt.data, countryId比較, エラーメッセージ)

## 追記 (2026-03-01 続き — ラウンド2)

### テスト品質改善（8件）
- クーポンファクトリのハードコード日付 → 相対日付
- `review.test.ts`: `Partial<ReviewDetailsType>` 型安全化
- `store.test.ts`: `any` → `Record<string, unknown>` + インターフェース
- `subCategory.test.ts`: spy 復元の try/finally 化
- `webhooks/route.ts`: `primaryEmail` 抽出 + 早期リターン
- `profile.ts`: 空バリアント商品を `.filter()` で除外
- `profile.test.ts`: 空ウィッシュリストの期待値修正
- `08-open-questions.md`: Known/Resolved Issues セクション分離

### コミット一覧
- `1803781` docs(specs): ラウンド2の修正を仕様書に反映
- `953a82c` test: テスト品質改善（型安全化・spy復元・日付相対化）
- `12f77dc` fix(webhook,profile): email検証・空バリアントガード

## 追記 (2026-03-01 続き — ラウンド3)

### プロダクションコード修正（2件）
- `store.ts`: `updateStoreStatus` に try/catch 追加
- `webhooks/route.ts`: upsert・metadata・delete を try/catch でラップ

### テスト追加（5件）
- `store.test.ts`: エラーメッセージ厳密化、DB失敗時500テスト（2件）
- `webhooks/route.test.ts`: upsert/metadata/delete 失敗時500テスト（3件）

### コミット一覧
- `5b4756c` test(webhook,store): エラーハンドリングテスト追加
- `3c2e82a` fix(webhook,store): 外部呼び出しのtry/catch追加

## 追記 (2026-03-02 — ラウンド4)

### プロダクションコード修正（3件）
- `webhooks/route.ts`: upsert lookup key `email` → `id`
- `webhooks/route.ts`: `delete` → `deleteMany` で冪等化
- `store.ts`: `db.$transaction` でアトミック化（プロジェクト初使用）

### テスト修正（4件）
- `webhooks/route.test.ts`: mockDeleteMany化、upsert assertion更新、冪等性テスト追加
- `store.test.ts`: `$transaction` モック、`MockPrismaClient` 導入、`any` 3箇所除去

### テスト統計
- 543テスト、21スイート全パス（R1: 536 → R2: 537 → R3: 542 → R4: 543）

### コミット一覧
- `1a2f82e` test(webhook,store): upsert/deleteMany変更反映・$transactionモック・any除去
- `f0470d7` fix(webhook,store): upsert lookup key変更・delete冪等化・$transaction導入

## 追記 (2026-03-14 〜 2026-03-16)

### AI スキル・エージェントシステム構築
- `.claude/skills/` に 5 つのスキルを追加:
  - `spec-sync-check`: 仕様と実装の乖離検出
  - `safe-migration`: Prisma マイグレーション安全実行
  - `server-action-scaffold`: サーバーアクションテンプレート生成
  - `test-complete`: テスト・リント一括実行と品質判定
  - `feature-plan`: 新機能の実装計画生成
- `.agent/skills/` に 4 つのプロジェクト専門エージェントを追加:
  - `ec-backend-expert`, `ec-db-migrator`, `ec-frontend-expert`, `ec-qa-expert`
- `.claude/agents/README.md` にサブエージェント定義ガイドラインを整備

### ラグジュアリーシードシステム構築（prisma/seed/）
- 5 フェーズシーダーアーキテクチャを新規構築:
  1. Base seeder（Country / User / Category / SubCategory / OfferTag）
  2. Store seeder（Store + ShippingRate）
  3. Product seeder（Product / Variant / Size / Image / Color / Spec / Question）
  4. Review seeder（Review + ReviewImage）
  5. Commerce seeder（Coupon / ShippingAddress / Order / OrderGroup / OrderItem）
- 型定義（`types.ts`）、ヘルパー（`helpers.ts`）、定数（`constants/`）を整備
- シードテスト（`prisma/seed/__tests__/`）: 冪等性・バリデーション・各 seeder のテストを追加
- `package.json` に `seed:luxury` スクリプトを追加

### DB スキーマ変更（3 マイグレーション）
- `20260314235842`: ShippingRate に `@@unique([storeId, countryId])` 追加
- `20260315104232`: 全金額フィールドを `Decimal(12,2)` に統一（Float からの revert）
- `20260315190000`: Review に `@@unique([userId, productId])` 追加

### Decimal 精度への全面移行
- 全金額フィールド（Store / Cart / CartItem / Order / OrderGroup / OrderItem / PaymentDetails / ShippingRate / Size）を `Decimal(12,2)` に統一
- サーバーアクション全体で `Prisma.Decimal` メソッド（`.add()`, `.mul()`, `.sub()`, `.toNumber()`）を使用
- UI コンポーネント（商品カード・価格表示・配送料・注文テーブル）を Decimal 対応に更新
- テストフィクスチャに `DecimalLike` 型と `toDecimal()` ヘルパーを導入

### エラーハンドリング標準化
- 全 `src/queries/` モジュールの catch ブロックを `error: unknown` + `instanceof Error` 型ガードに統一
- `console.error` にコンテキストプレフィックス・メッセージ・スタックを含む構造化ログを導入
- `placeOrder()` を `db.$transaction` でアトミック化（注文作成 + 在庫減算）

### テスト拡充
- 686 テスト、30 スイート全パス（R4: 543/21 → 686/30）
- 新規テストファイル: `home.test.ts`, `product.test.ts`（拡充）, `user.test.ts`（拡充）
- シードテスト 9 ファイル追加（`prisma/seed/__tests__/`）

### コード品質・Docstrings 追加
- `prisma/seed/` 以下のシーダー群およびヘルパー関数に大量の Docstrings (JSDoc) を追加（#91）
- UI コンポーネントおよびページコンポーネントの一部に Docstrings を追加

### ドキュメント・仕様書更新
- `specs/03-data-model.md`: Decimal(12,2) 記載、ShippingRate / Review の複合ユニーク制約を追記
- `specs/06-quality.md`: Decimal 精度・トランザクション・構造化ログを追記
- `specs/07-testing.md`: テスト数更新、`prisma/seed/__tests__/` 追加
- `specs/05-workflows.md`: Customer Purchase Flow にサーバーサイド検証・トランザクション詳細を追加
- `specs/08-open-questions.md`: 配送料計算・在庫ロックの 2 項目を Resolved Issues に移動
- `specs/04-interfaces.md`: `home` モジュールを Notable modules に追加
- `README.md`: ER 図の Decimal 修正、ディレクトリ構成に全 query モジュールと `prisma/seed/` を追加
- `CLAUDE.md`: `seed:luxury` コマンドを追加
- `docs/testing/TESTING_DESIGN.md`: 未実装テストスクリプトを明示
- `.claude/steering/tech.md`: console.log ルール・シードテストガイダンスを更新

### 主要コミット一覧（新しい順）
- `f3248ac` Merge pull request #92
- `fc94e58` refactor: refine home queries and align user test logic with Decimal precision
- `64eaefb` refactor: refine order logic and strengthen error handling in queries
- `3e9cce6` refactor: finalize shipping UI refactor and standardize query error logging
- `fd9caef` refactor: exhaustive Decimal serialization fixes and type-safe error handling
- `d005a63` 📝 Add docstrings to `dev` (#91)
- `277d96d` refactor: finalize Decimal serialization and update technical specs
- `38dbcba` fix(queries): wrap order placement in transaction
- `d46e00e` refactor: comprehensive Decimal precision refinements
- `f580a5e` fix(db): add unique constraint to reviews and refine shipping rate upsert
- `b053a59` refactor: revert money fields to Decimal for precision
- `0a407e5` feat(db): add unique constraint to ShippingRate
- `aff89f9` feat(seed): seed オーケストレーションとエントリポイントを実装
- `e1761c9` feat(seed): コマース seeder 実装
- `0346db9` feat(seed): 商品 seeder 実装
- `d3f4a7c` feat(seed): ストア seeder 実装
- `018689f` feat(seed): 基底 seeder 実装
- `06ce166` feat(seed): 型定義とヘルパー関数を実装
- `8f7d131` feat(skills): spec-sync-check スキルを追加
- `e14142d` feat(skills): feature-plan スキルを追加
- `f2b7354` feat(agent): add project-specific expert skills

---

## 追記進捗レポート (2026-03-23)

### 範囲
- 対象: Round 10 以降のドキュメント改善作業
- 主要コミット: `e9ba2d0`, `50e5982`, `8f5ca4b`, `2f2d22c`

### 今日の対応サマリ
- ドキュメント不整合の修正（8箇所）
- `.claude/plans/archive/` の削除と理由説明
- ドキュメント管理戦略の確立（ADR ガイドライン）
- 相対パス表記の統一

## ドキュメント品質改善

### Round 10: ドキュメント不整合の修正 (`e9ba2d0`)
- 6 ファイル、19 挿入、20 削除
- 修正内容：
  1. INDEX.md: `[current]` プレースホルダーを `055934f` に置換
  2. INDEX.md: 相対リンクパス修正（`../../` → `../../../`）
  3. round-7-9-e2e-improvements.md: 5箇所の相対リンク修正
  4. .gitignore: 冗長な `*.backup` パターン削除
  5. TEST_IMPLEMENTATION_PLAN.md: `addItemToCart` シグネチャに `variantSlug` 追加
  6. TEST_IMPLEMENTATION_PLAN.md: 3つのテストステータスを ⏸️ → ✅ に更新
  7. TESTING_DESIGN.md: JavaScript truthiness 説明修正（`"0"` は truthy）
  8. specs/07-testing.md: `addItemToCart` 例に `variantSlug` 追加

### Archive ディレクトリの削除 (`50e5982`)
- 2 ファイル削除、683 行削除
- 削除理由：
  - Round 7-9 の有用な情報は既に正式ドキュメントに統合済み
  - Git 履歴で十分なトレーサビリティを確保
  - メンテナンスコストが価値を上回る
- 統合先：
  - E2E ヘルパー関数 → `docs/testing/TESTING_DESIGN.md`
  - 環境変数処理 → `.claude/steering/tech.md`
  - 配送料計算 → `.claude/steering/tech.md`
  - テストステータス → `docs/testing/TEST_IMPLEMENTATION_PLAN.md`

### ドキュメント管理戦略の確立 (`8f5ca4b`)
- 5 ファイル追加、648 行追加
- 新規ファイル：
  1. `.claude/steering/documentation-guide.md` (289 行)
     - 4層構造のドキュメント体系説明
     - Decision Tree（Q1-Q5）による配置基準
     - ADR 作成基準（4条件すべて満たす場合のみ）
     - 実装パターン vs ADR の判断表
  2. `docs/architecture/README.md`
     - アーキテクチャドキュメントの概要
  3. `docs/architecture/decisions/README.md`
     - ADR 作成ガイド、ライフサイクル管理
  4. `docs/architecture/decisions/template.md`
     - MADR 形式テンプレート
  5. `CLAUDE.md` 更新
     - `documentation-guide.md` への参照追加

### 相対パス表記の統一 (`2f2d22c`)
- 1 ファイル、1 挿入、1 削除
- `documentation-guide.md` Line 151: `template.md` をクリック可能なMarkdownリンクに変更

## ドキュメント配置ルール

### Decision Tree

```
Q1: 全プロジェクトで不変のルールか？ → .claude/steering/tech.md
Q2: 機能仕様の一部か？ → specs/multi-vendor-ecommerce/
Q3: 実装の詳細な手順・パターンか？ → docs/testing/TESTING_DESIGN.md
Q4: 過去の技術選定・移行の理由か？ → docs/architecture/decisions/ (ADR)
Q5: それ以外（進捗・一時的）→ PROGRESS.md
```

### ADR 作成基準
以下の4条件を**すべて**満たす場合のみ作成：
1. 複数の代替案を比較検討した
2. チーム全体に影響する技術選定
3. 将来の技術選定時に参照価値がある
4. トレードオフが将来の開発に影響する

## 現在のドキュメント品質評価

| 評価軸 | スコア | 所見 |
|--------|--------|------|
| 指標性（可検索性） | ⭐⭐⭐⭐ | specs/README.md で読み順が明確 |
| トレーサビリティ | ⭐⭐⭐⭐ | コミットハッシュ付きで変更履歴記録 |
| 更新頻度との同期 | ⭐⭐⭐⭐⭐ | 実装後即座に仕様書更新 |
| 決定背景の記録 | ⭐⭐⭐⭐ | ADR フレームワーク準備完了 |
| ADR 検索性 | ⭐⭐⭐⭐ | 配置ルール明確化により改善 |

## ベストプラクティス確立

### ✅ 推奨
- 小さく始める：最初は既存ドキュメント追記、大規模変更時のみ ADR
- コミットハッシュ記録：変更内容に関連するコミットを明記
- 定期的なレビュー：3-6ヶ月ごとにドキュメント鮮度確認
- Git 履歴活用：`git log` で補完できる情報は過度に記録しない

### ❌ 避けるべき
- 過剰な文書化：実装の詳細すぎる記録
- ADR の乱用：小さな実装判断で ADR 作成しない
- 重複記録：同じ情報を複数の場所に記録しない
- 古い情報の放置：実装と乖離したドキュメントは削除または更新

## 主要コミット一覧（新しい順）
- `2f2d22c` docs: fix template.md reference to use consistent relative path
- `8f5ca4b` docs: establish documentation management strategy with ADR guidelines
- `50e5982` chore: remove redundant plans archive directory
- `e9ba2d0` docs: fix documentation inconsistencies found in review

## 期待される効果
- **明確な配置基準**: 新しい設計決定をどこに記録すべきか迷わない
- **検索性の向上**: 技術選定理由が一元的に管理される
- **スケーラビリティ**: チーム規模拡大時にも機能するドキュメント体系
- **エージェント対応**: Claude Code エージェントが自動参照可能

### 次アクション候補
- ドキュメント配置ルールの実践（新しい設計決定発生時）
- 3-6ヶ月後のドキュメント鮮度レビュー
- 必要に応じて ADR の作成（大規模技術変更時）

---

## 追記 (2026-03-28) — Next.js 16 マイグレーション完了 + ドキュメント全体更新

### 範囲
- ブランチ: `feat/nextjs-16-migration`
- 対象: Next.js/React/Clerk/Swiper/ESLint の一括バージョンアップ + コードレビュー3ラウンド + ドキュメント全体更新

---

### Phase 0-7: フレームワーク移行（7コミット）

#### 移行内容

| Package | Before | After | 主な Breaking Changes |
|---------|--------|-------|-----------------------|
| Next.js | 14.x | 16.2.1 | `params`/`searchParams`/`cookies`/`headers` が Promise 化 |
| React | 18.x | 19.x | `useRef<T>(null)` → `RefObject<T \| null>`、`use()` フック導入 |
| `@clerk/nextjs` | v6 | v7 | `auth()`/`currentUser()` が async に、`authMiddleware` 廃止 |
| Swiper | 11.x | 12.x | `SwiperRef` が `swiper/react` から直接エクスポート |
| ESLint | 8.x | 9.x | `.eslintrc.*` 廃止 → `eslint.config.mjs` (flat config) |

#### 適用した修正パターン

1. **Async params** — Server Component では `await params`、Client Component では `use(params)`
2. **Async cookies** — `const cookieStore = await cookies()`
3. **Clerk v7** — `await auth()`、`await currentUser()`、`await clerkClient()`
4. **useRef 型** — `use-onclickoutside` を module augmentation で `RefObject<HTMLElement | null>` に対応
5. **ESLint flat config** — `react-hooks` ルールを `files: ["**/*.{tsx,jsx}"]` にスコープ

#### 主要コミット（新しい順）
- `0f2bca7` chore(deps): upgrade React 18 to React 19 with compatibility fixes
- `2e7d706` chore(deps): upgrade Next.js 14 to 16.2.1 with ESLint 9 flat config
- `fcdb042` refactor: migrate to async request APIs for Next.js 16
- `ac774da` chore(deps): upgrade @clerk/nextjs to v7 for Next.js 16 compatibility
- `9482e25` chore(deps): upgrade Swiper 11 to 12.1.3
- `622721e` refactor: remove legacyBehavior Link pattern
- `a597593` fix: address post-migration code quality issues

---

### コードレビュー Round 1-3: コード品質修正（3コミット）

#### 確立されたパターン

| パターン | 適用箇所 | 内容 |
|---------|---------|------|
| `Number.isFinite` page 正規化 | `profile/following/`, `profile/wishlist/` | `Infinity`/`NaN`/小数を排除 |
| `Object.hasOwn` フィルター検証 | `profile/orders/[filter]/` | `in` 演算子のプロトタイプ汚染リスクを排除 |
| `parseUserCountryCookie` 集約 | `cart/`, `checkout/`, `header/`, `queries/product.ts`, `queries/user.ts` | 生 `JSON.parse` + キャストを排除 |
| `isCountry` 型ガード強化 | `src/lib/utils.ts` | `name`/`code`/`city`/`region` の4フィールドをすべて検証 |
| `useEffect` キャンセルフラグ | `profile/history/` | 非同期レースコンディション防止 |
| localStorage 型検証 | `profile/history/` | `Array.isArray` + `every(x => typeof x === "string")` |
| `Awaited<ReturnType<>>` | `seller/stores/.../orders/` | `let` 宣言の型推論エラーを排除 |
| Clerk v7 `async` layout | `profile/layout.tsx` | `currentUser()` await に対応して `async` 化 |
| module augmentation | `src/types/use-onclickoutside.d.ts` | React 19 の `RefObject<T \| null>` に対応 |

#### 主要コミット（新しい順）
- `c789e34` refactor: apply parseUserCountryCookie to product and user queries
- `a287272` fix: improve type safety and add cleanup logic to profile pages
- `dd3bf0d` refactor: improve type safety, error handling and cookie parsing

---

### ドキュメント全体更新

次の6ファイルを現状のコードと整合させた：

| ファイル | 変更内容 |
|---------|---------|
| `.claude/steering/tech.md` | Next.js 16.2.1・React 19 行追加・ESLint 9 flat config・cookie パース規約・URL パラメータ正規化規約・3つの新実装パターン・Clerk v7 async API パターン |
| `specs/multi-vendor-ecommerce/02-architecture.md` | "Next.js 16.2.1"・"React 19"・"Clerk v7" に更新 |
| `specs/multi-vendor-ecommerce/07-testing.md` | テスト数 686/30 → 881/54 に更新 |
| `docs/migration/06-framework-upgrade.md` | 新規作成。5つのフレームワーク移行の breaking changes と修正パターンを一括記録 |
| `docs/migration/README.md` | タイトルを "Migration Documentation" に変更、フレームワーク移行セクションと新ファイルへのリンクを追加 |
| `PROGRESS.md` | 本エントリを追記 |

---

### テスト統計（最終）
- 881 ユニットテスト、54 スイート（全パス）
- Playwright E2E: 3 ブラウザ（Chromium / Firefox / WebKit）

### 現在のブランチ状態
- `feat/nextjs-16-migration` → `main` へのマージ完了（`2c9665e`）
