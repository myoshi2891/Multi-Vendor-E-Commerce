# テスト戦略更新ガイド

## ドキュメントガイド

- 本書は MySQL → PostgreSQL 移行後のテスト戦略変更点を定義する
- 関連: `TESTING_DESIGN.md`, `00-compatibility-matrix.md`

---

## 1. 影響を受けるテスト領域

| テスト種別 | 影響度 | 対応内容 |
|---|:---:|---|
| **Unit テスト** | 低 | DB 非依存のためほぼ変更なし |
| **Component テスト** | なし | DB に依存しない |
| **Integration テスト** | 高 | DB 接続先を PostgreSQL に変更 |
| **API テスト** | 中 | 生 SQL を使用するルートの期待値変更 |
| **E2E テスト** | 中 | シード戦略・接続先の変更 |

---

## 2. Integration テスト

### 2-1. `TESTING_DESIGN.md` の更新箇所

| 行 | 現在 | 更新後 |
|---|---|---|
| L40 | `- DB: MySQL test database using Docker Compose` | `- DB: PostgreSQL test database using Docker Compose` |
| L111 | `- Use a dedicated MySQL schema for tests.` | `- Use a dedicated PostgreSQL database for tests.` |
| L123 | `E2E_DATABASE_URL="mysql://user:pass@localhost:3306/app_test"` | `E2E_DATABASE_URL="postgresql://user:pass@localhost:5432/app_test"` |

### 2-2. Docker Compose（テスト用）

```yaml
# 変更前（MySQL）
services:
  mysql-test:
    image: mysql:8.0
    ports: ["3306:3306"]
    environment:
      MYSQL_ROOT_PASSWORD: test
      MYSQL_DATABASE: app_test

# 変更後（PostgreSQL）
services:
  postgres-test:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: app_test
```

### 2-3. Integration テストの接続先に関する注意

Prisma Accelerate はデータアクセスの高速化と接続制限の緩和を目的としているため、マイグレーションや頻繁なデータリセットが発生する **Integration テスト** では直接接続（Neon Direct connection）を使用します。

- 開発環境：ローカルの Docker PostgreSQL または Neon の Direct connection
- CI テスト：GitHub Actions 上の PostgreSQL サービスコンテナ

> [!TIP]
> テスト環境で Accelerate を使用すると、クォータの消費や初期化のオーバーヘッドが発生するため、直接接続を推奨します。

### 2-4. DB リセットスクリプト

`tests-setup/db.reset.ts` がある場合、接続先の変更に対応。
Prisma 経由のリセットであればスキーマ更新のみで対応可能。

---

## 3. API テスト

### 影響を受けるルート

| ファイル | 理由 |
|---|---|
| `src/app/api/search-products/route.ts` | `MATCH...AGAINST` → `to_tsvector` に変更後、レスポンス構造が異なる可能性 |

### テストの更新ポイント

- 検索結果の `relevance` スコア値が異なる（`ts_rank` のスケールは MySQL と異なる）
- テスト内で exact なスコア値をアサートしない（順序のみ確認）

---

## 4. E2E テスト

### 4-1. シードスクリプトの変更

`tests/e2e/seed/seed-e2e.ts` は Prisma Client 経由でデータを投入するため、
スキーマ変更後に `npx prisma generate` を実行すれば基本的に変更不要。

ただし、生 SQL を使用している箇所がある場合は構文を PostgreSQL 互換に更新する。

### 4-2. シード実行コマンド

```bash
# 変更前
E2E_DATABASE_URL="mysql://user:pass@localhost:3306/app_test" bun run seed:e2e

# 変更後
E2E_DATABASE_URL="postgresql://user:pass@localhost:5432/app_test" bun run seed:e2e
```

### 4-3. テストシナリオへの影響

| シナリオ | 影響 | 理由 |
|---|:---:|---|
| カート追加 | なし | Prisma API 経由 |
| 商品検索 | 要確認 | フルテキスト検索結果の順序が変わる可能性 |
| チェックアウト | なし | Prisma API 経由 |
| ダッシュボード表示 | なし | Prisma API 経由 |

---

## 5. CI パイプラインの変更

### `TESTING_DESIGN.md` L161-166 の CI 順序

変更箇所なし（手順自体は同じ）。ただし環境変数とサービスコンテナを変更。

### GitHub Actions の変更例

```yaml
# 変更前
services:
  mysql:
    image: mysql:8.0
    env:
      MYSQL_ROOT_PASSWORD: test
      MYSQL_DATABASE: app_test
    ports: ["3306:3306"]

# 変更後
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: app_test
    ports: ["5432:5432"]
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

---

## 6. 新たに追加すべきテスト

| テスト | 目的 | 優先度 |
|---|---|:---:|
| フルテキスト検索（PostgreSQL `tsvector`） | 検索結果の正確性を検証 | 高 |
| `contains` + `mode: "insensitive"` | 大文字小文字を区別しない検索の動作確認 | 中 |
| ランダム取得（`RANDOM()`） | サブカテゴリのランダム取得が正常に動作するか | 低 |
