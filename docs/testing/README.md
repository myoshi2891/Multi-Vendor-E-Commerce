# マルチベンダーEC テストドキュメント

## 概要

このドキュメントは、マルチベンダーECプロジェクトのユニットテスト作成をサポートするためのガイドです。

### 現在のテスト状況

| 項目                 | 値                          |
| -------------------- | --------------------------- |
| テストフレームワーク | Jest + ts-jest              |
| 現在のカバレッジ     | 約0.6%                      |
| 既存テストファイル   | 2ファイル（32テストケース） |
| 目標カバレッジ       | 80%以上                     |

### 既存テスト

- `src/queries/store.test.ts` - ストア管理機能（23テストケース）
- `src/queries/size.test.ts` - サイズフィルタリング（9テストケース）

---

## クイックスタート

### テスト実行

```bash
# 全テスト実行
npm test

# ウォッチモード（ファイル変更時に自動再実行）
npm run test:watch

# 特定のテストファイルのみ実行
npm test store.test.ts
npm test -- --testPathPattern="store"

# カバレッジレポート生成
npm test -- --coverage
```

### 新規テスト追加の流れ

1. 対象ファイルと同じディレクトリに `*.test.ts` ファイルを作成
2. [テスト作成ガイドライン](./02-test-guidelines.md)に従ってテストを記述
3. [モック作成ガイド](./03-mock-guide.md)を参考にモックを設定
4. テスト実行して確認

---

## ドキュメント一覧

| ドキュメント                                         | 説明                                               |
| ---------------------------------------------------- | -------------------------------------------------- |
| [01-test-case-catalog.md](./01-test-case-catalog.md) | 全テストケース一覧（優先度別、チェックリスト付き） |
| [02-test-guidelines.md](./02-test-guidelines.md)     | テスト作成ガイドライン（命名規則、AAAパターン等）  |
| [03-mock-guide.md](./03-mock-guide.md)               | モック作成ガイド（Prisma、Clerk、外部API）         |
| [04-test-patterns.md](./04-test-patterns.md)         | テストパターン集（認証、CRUD、計算ロジック等）     |
| [05-priority-matrix.md](./05-priority-matrix.md)     | 優先度マトリクスと進捗トラッキング                 |

### テンプレート

| テンプレート                                                                 | 用途                                   |
| ---------------------------------------------------------------------------- | -------------------------------------- |
| [server-action-test.template.ts](./templates/server-action-test.template.ts) | Server Action用テストテンプレート      |
| [api-route-test.template.ts](./templates/api-route-test.template.ts)         | API Route用テストテンプレート          |
| [utility-test.template.ts](./templates/utility-test.template.ts)             | ユーティリティ関数用テストテンプレート |

---

## プロジェクト構造

```text
src/
├── queries/                    # Server Actions（テスト対象）
│   ├── store.ts               # ストア管理
│   ├── store.test.ts          # ✅ テスト済み
│   ├── product.ts             # 商品管理
│   ├── user.ts                # ユーザー・カート管理
│   ├── order.ts               # 注文管理
│   ├── coupon.ts              # クーポン管理
│   ├── review.ts              # レビュー管理
│   ├── paypal.ts              # PayPal決済
│   ├── stripe.ts              # Stripe決済
│   ├── size.ts                # サイズフィルタリング
│   ├── size.test.ts           # ✅ テスト済み
│   └── ...
├── lib/
│   ├── utils.ts               # ユーティリティ関数
│   ├── schemas.ts             # Zodバリデーションスキーマ
│   └── db.ts                  # Prismaクライアント
├── app/api/                    # API Routes
│   ├── search-products/       # 商品検索API
│   └── webhooks/              # Webhook処理
└── config/
    └── test-config.ts         # テスト設定定数
```

---

## テスト優先度

### Phase 1: 高優先度（91テストケース）

金銭処理・セキュリティに関わる重要機能

- 決済処理（PayPal、Stripe）
- 注文管理
- カート・チェックアウト
- クーポン
- Webhook認証

### Phase 2: 中優先度（225テストケース）

コアビジネスロジック

- 商品管理
- ストア管理
- ユーザー管理
- プロファイル
- レビュー
- ユーティリティ関数
- バリデーションスキーマ

### Phase 3: 低優先度（62テストケース）

補助機能

- カテゴリ管理
- サブカテゴリ管理
- オファータグ
- ホームページデータ

---

## 関連リソース

- [Jest公式ドキュメント](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/)
- [ts-jest](https://kulshekhar.github.io/ts-jest/)
- プロジェクトのテスト設定: `/jest.config.js`
- テスト定数: `/src/config/test-config.ts`
