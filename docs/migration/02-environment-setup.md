# 環境変数変更ガイド

## ドキュメントガイド

- 本書は MySQL → PostgreSQL 移行時の環境変数変更手順を定義する
- 関連: `00-compatibility-matrix.md`, `01-data-migration-guide.md`

---

## 1. `DATABASE_URL` の変更

### 接続文字列の形式比較

| | MySQL（現在） | PostgreSQL（変更後） |
|---|---|---|
| 形式 | `mysql://USER:PASS@HOST:PORT/DB` | `postgresql://USER:PASS@HOST:PORT/DB?schema=public` |
| デフォルトポート | `3306` | `5432` |
| スキーマ指定 | 不要 | `?schema=public`（推奨） |

### 変更例

```bash
# .env（変更前）
DATABASE_URL="mysql://DB_USER:DB_PASSWORD@localhost:3306/multivendor_ecommerce"

# .env（変更後）
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@localhost:5432/multivendor_ecommerce?schema=public"
```

> **注意**: パスワードに特殊文字（`@`, `#`, `%` 等）が含まれる場合、URL エンコードが必要。

---

## 2. `SHADOW_DATABASE_URL`（オプション）

Prisma の `migrate dev` はシャドウデータベースを使用する。
PostgreSQL ではデフォルトで自動作成されるが、権限がない環境では明示指定が必要。

```bash
# .env（必要な場合のみ）
SHADOW_DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@localhost:5432/multivendor_ecommerce_shadow?schema=public"
```

事前にシャドウ DB を作成:

```bash
createdb multivendor_ecommerce_shadow
```

---

## 3. テスト環境の接続文字列

### `.env.test`

```bash
# .env.test（変更前）
# E2E_DATABASE_URL="mysql://user:pass@localhost:3306/app_test"

# .env.test（変更後）
E2E_DATABASE_URL="postgresql://user:pass@localhost:5432/app_test?schema=public"
```

### E2E シード実行コマンドの変更

```bash
# 変更前
E2E_DATABASE_URL="mysql://user:pass@localhost:3306/app_test" bun run seed:e2e

# 変更後
E2E_DATABASE_URL="postgresql://user:pass@localhost:5432/app_test" bun run seed:e2e
```

---

## 4. その他の環境変数（変更不要）

以下の環境変数は DB 移行の影響を受けない:

| 変数名 | 影響 |
|---|---|
| `STRIPE_SECRET_KEY` | 変更不要 |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | 変更不要 |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | 変更不要 |
| `PAYPAL_SECRET` | 変更不要 |
| `WEBHOOK_SECRET` | 変更不要 |
| Clerk 関連変数 | 変更不要 |
| Cloudinary 関連変数 | 変更不要 |

---

## 5. PostgreSQL ローカル環境のセットアップ

### macOS（Homebrew）

```bash
# インストール
brew install postgresql@16

# サービス起動
brew services start postgresql@16

# ユーザー設定（必要に応じて）
psql postgres -c "CREATE USER DB_USER WITH PASSWORD 'DB_PASSWORD';"

# データベース作成
createdb -O DB_USER multivendor_ecommerce

# 接続確認
psql -d multivendor_ecommerce -c "SELECT version();"
```

### Docker（代替方法）

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: DB_USER
      POSTGRES_PASSWORD: DB_PASSWORD
      POSTGRES_DB: multivendor_ecommerce
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```bash
docker compose up -d
```

---

## 6. 切替チェックリスト

- [ ] PostgreSQL インスタンスが起動している
- [ ] データベース `multivendor_ecommerce` が作成済み
- [ ] `.env` の `DATABASE_URL` を PostgreSQL 形式に変更
- [ ] `SHADOW_DATABASE_URL` を設定（必要な場合）
- [ ] `.env.test` の `E2E_DATABASE_URL` を更新
- [ ] `psql` で接続確認済み
