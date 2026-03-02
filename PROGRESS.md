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

### テスト品質改善（9件）
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

### テスト追加（4件）
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
