# 環境変数変更ガイド

## ドキュメントガイド

- 本書は MySQL → PostgreSQL 移行時の環境変数変更手順を定義する
- 関連: `00-compatibility-matrix.md`, `01-data-migration-guide.md`

---

## 1. 接続文字列の変更（Neon + Accelerate）

Prisma Accelerate を使用する場合、**データアクセス用**と**マイグレーション用**の2つのURLを使い分けます。

| 種類 | 環境変数名 | 接続形式 | 用途 |
|---|---|---|---|
| **Data Proxy** | `DATABASE_URL` | `prisma://accelerate.prisma-data.net/...` | アプリケーションからのデータアクセス |
| **Direct connection** | `DIRECT_URL` | `postgresql://user:pass@ep-xxxx.neon.tech/db` | `prisma migrate`, `prisma db push` 等 |

### 変更例（`.env`）

```bash
# Prisma Accelerate URL (Prismaダッシュボードで取得)
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=your_api_key"

# Neon Direct connection URL (Neonダッシュボードで取得)
DIRECT_URL="postgresql://<YOUR_USER>:<YOUR_PASSWORD>@ep-xxxx.neon.tech/multivendor_ecommerce?sslmode=require"
```

> **重要**: `schema.prisma` の `datasource` ブロックにも `directUrl = env("DIRECT_URL")` を追記する必要があります。

---

## 2. Neon / Accelerate 固有の設定

### 2-1. Neon プロジェクトでの取得

1. Neon の Dashboard から `Connection Details` を開き、`Direct connection` にチェックを入れた状態の URL を `DIRECT_URL` とします。
2. `Pooling` は Prisma Accelerate が担当するため、Neon 側の `Pooling` オプションはオフのままでも構いません。

### 2-2. Prisma Accelerate の有効化

1. [Prisma Console](https://console.prisma.io/) にログイン。
2. 新しいプロジェクトを作成し、Neon の `Direct connection` URL をデータベースとして登録。
3. 生成された接続文字列を `DATABASE_URL` に設定します。

---

## 3. テスト環境の接続文字列

### `.env.test`

```bash
# .env.test（変更前）
# E2E_DATABASE_URL="mysql://user:pass@localhost:3306/app_test"

# .env.test（変更後）
E2E_DATABASE_URL="postgresql://user:pass@localhost:5432/app_test"
```

### E2E シード実行コマンドの変更

```bash
# 変更前
E2E_DATABASE_URL="mysql://user:pass@localhost:3306/app_test" bun run seed:e2e

# 変更後
E2E_DATABASE_URL="postgresql://user:pass@localhost:5432/app_test" bun run seed:e2e
```

---

## 4. Vercel 環境変数の設定

Vercel でデプロイする場合、以下の環境変数を設定します。

```
Project → Settings → Environment Variables
```

| 変数名 | 値 |
|---|---|
| `DATABASE_URL` | Prisma Accelerate の URL（`prisma://accelerate.prisma-data.net/...`） |
| `DIRECT_URL` | Neon の Direct connection URL |

設定後に再デプロイを行ってください。

---

## 5. Runtime 制約（重要）

App Router 使用時、Neon の TCP 接続のため **Edge Runtime は使用不可** です。
データベースにアクセスするルート・サーバーアクションには以下を明示してください。

```ts
export const runtime = 'nodejs'
```

> [!WARNING]
> `export const runtime = 'edge'` を設定すると、Neon への TCP 接続が失敗します。

---

## 6. その他の環境変数（変更不要）

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

## 7. MySQL ローカル環境のセットアップ（移行元）

ローカルで MySQL を起動し、移行前のアプリを動作確認する手順です。

### macOS（Homebrew）

```bash
# インストール
brew install mysql

# サービス起動
brew services start mysql

# 停止
brew services stop mysql
```

### MySQL 9 の認証プラグイン問題（重要）

MySQL 8.4 以降、デフォルト認証プラグインが `caching_sha2_password` に変更されました。
Prisma が使用する `mysql2` ドライバが RSA 公開鍵を取得できるよう、`DATABASE_URL` にパラメータを追加してください。

```bash
DATABASE_URL="mysql://<DB_USER>:<DB_PASSWORD>@localhost:3306/multivendor_ecommerce?allowPublicKeyRetrieval=true"
```

> [!WARNING]
> MySQL 9.x（Homebrew）では `mysql_native_password` プラグインが廃止されています。
> `ALTER USER ... IDENTIFIED WITH mysql_native_password` は使用できません。
> `allowPublicKeyRetrieval=true` クエリパラメータで対応してください。

### ユーザーとデータベースの初期作成

MySQL が新規インストール（ユーザー・DB 未作成）の場合：

```bash
# root でログイン（パスワードなし）
mysql -u root
```

```sql
-- ユーザー作成
CREATE USER '<DB_USER>'@'localhost' IDENTIFIED BY '<DB_PASSWORD>';

-- DB 作成
CREATE DATABASE multivendor_ecommerce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 権限付与（shadow DB 作成権限含む）
GRANT ALL PRIVILEGES ON *.* TO '<DB_USER>'@'localhost';
FLUSH PRIVILEGES;
```

> `GRANT ALL ON *.*`（グローバル権限）は `prisma migrate dev` が shadow DB を作成するために必要です。
> セキュリティが気になる場合は `GRANT ALL ON multivendor_ecommerce.* TO ...` とし、
> 加えて `GRANT CREATE ON *.* TO ...` を付与してください。

### Prisma マイグレーション実行

```bash
bunx prisma migrate dev
```

---

## 8. PostgreSQL ローカル環境のセットアップ（移行先）

### macOS（Homebrew）

```bash
# インストール
brew install postgresql@16

# サービス起動
brew services start postgresql@16

# ユーザー設定（必要に応じて）
# <YOUR_USER> と <YOUR_PASSWORD> は任意の値に置き換えてください
psql postgres -c "CREATE USER <YOUR_USER> WITH PASSWORD '<YOUR_PASSWORD>';"

# データベース作成
createdb -O <YOUR_USER> multivendor_ecommerce

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
      POSTGRES_USER: "<YOUR_USER>"
      POSTGRES_PASSWORD: "<YOUR_PASSWORD>"
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

## 9. 切替チェックリスト

### 移行前（MySQL ローカル確認）

- [ ] MySQL サービスが起動済み（`brew services start mysql`）
- [ ] `DATABASE_URL` に `?allowPublicKeyRetrieval=true` が含まれている（MySQL 9 使用時）
- [ ] データベースユーザーがグローバル権限（`GRANT ALL PRIVILEGES ON *.*`）を持つ
- [ ] `prisma migrate dev` が成功している

### 移行後（Neon + Accelerate）

- [ ] Neon プロジェクトが作成済み
- [ ] Neon の Direct connection URL を取得
- [ ] Prisma Accelerate が有効化済み
- [ ] `.env` の `DATABASE_URL` を Accelerate 形式に変更
- [ ] `.env` に `DIRECT_URL` を追加
- [ ] `schema.prisma` に `directUrl = env("DIRECT_URL")` を追加
- [ ] Vercel の環境変数を更新（`DATABASE_URL` + `DIRECT_URL`）
- [ ] Vercel Preview 環境が本番 DB と**分離**されていることを確認
- [ ] `.env.test` の `E2E_DATABASE_URL` を更新
- [ ] Node.js runtime が明示されている（Edge runtime 不使用）
- [ ] 接続確認済み

---

## 10. Neon ブランチを使った PR / Preview 環境の分離

PR ごとに Neon DB ブランチを作成し、Vercel Preview と連携することで、
本番データを汚染せずにレビュー・テストができます。

### ブランチ構成

```
main       → Vercel Production  ← 本番 Neon ブランチ
feature/*  → Vercel Preview     ← PR ごとの Neon ブランチ
```

### GitHub Actions サンプル（`.github/workflows/neon-branch.yml`）

```yaml
name: Neon Branch for PR

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  create-branch:
    runs-on: ubuntu-latest
    steps:
      - name: Create Neon Branch
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.NEON_API_KEY }}" \
            https://console.neon.tech/api/v2/projects/${{ secrets.NEON_PROJECT_ID }}/branches \
            -d '{"branch": {"name": "pr-${{ github.event.number }}"}}'
```

> `secrets.NEON_API_KEY` と `secrets.NEON_PROJECT_ID` は GitHub リポジトリの
> Settings → Secrets and variables → Actions に登録してください。

### Vercel 環境変数の設定

| 環境 | `DATABASE_URL` の値 |
|---|---|
| Production | Neon の `main` ブランチ接続 URL |
| Preview | Neon の PR ブランチ接続 URL |

> **個人開発の現フェーズでは PR ごとのブランチ自動作成は不要。**
> `main` + `staging` の2構成で十分です。
> チームが増えるか migration 頻度が高まった時点で導入を検討してください。
