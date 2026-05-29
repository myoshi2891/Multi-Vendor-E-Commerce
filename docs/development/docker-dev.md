# Docker 開発環境

Next.js アプリ + ローカル PostgreSQL を Docker でフルスタック起動するための手順。
ホストに Bun / Postgres を直接入れなくても開発を始められる。

> 本番 (Vercel + Neon) とは無関係の、使い捨て可能なローカル開発専用構成。
> integration テスト用の `docker-compose.test.yml`（port 55432）とは別物で、**同時起動可能**。

---

## 構成

| サービス | 内容 | ホスト公開ポート |
|---|---|---|
| `app` | Next.js 開発サーバー（`bun run dev`、`oven/bun:1.3.14`） | 3000 / 5555（Studio） |
| `db` | PostgreSQL 16.14（digest 固定、`docker-compose.test.yml` と同一） | 5432 |

- ソースは bind mount され、`WATCHPACK_POLLING=true` で HMR が効く。
- `node_modules` は named volume（`app-node-modules`）で保護し、ホスト側で上書きしない。
- DB データは named volume（`postgres-dev-data`）に永続化。`make down-v` で破棄できる。

関連ファイル: [`Dockerfile.dev`](../../Dockerfile.dev) / [`docker-compose.yml`](../../docker-compose.yml) / [`Makefile`](../../Makefile)

---

## セットアップ

```bash
# 1. 環境変数テンプレートをコピー
cp .env.docker.example .env.docker
#    認証/決済を実際に通す場合は Clerk 等の test キーを .env.docker に記入する
#    (stub のままでも DB アクセス系の開発は可能)

# 2. ビルド → 起動 → DB 起動待ち → migrate → seed を一括実行
make setup

# 3. ログ確認
make logs            # http://localhost:3000
```

`make setup` は冪等。再実行しても seed は upsert で安全に再投入される。

---

## よく使うコマンド

`make help` で全ターゲットを一覧表示。主なもの:

| コマンド | 用途 |
|---|---|
| `make up` | ビルドしてバックグラウンド起動 |
| `make down` | 停止（DB データは保持） |
| `make down-v` | 停止 + ボリューム削除（DB 完全リセット） |
| `make logs` | アプリのログを追従 |
| `make sh` | アプリコンテナでシェル |
| `make psql` | DB に `psql` 接続 |
| `make migrate` | `prisma migrate dev`（開発用マイグレーション生成） |
| `make generate` | Prisma クライアント再生成 |
| `make studio` | Prisma Studio（http://localhost:5555） |
| `make seed` / `make seed-e2e` | シード投入 |
| `make lint` / `make test` / `make test-e2e` | 品質チェックをコンテナ内で実行 |

ホストから直接 DB に繋ぐ場合は `postgresql://dev:dev@localhost:5432/multivendor_dev`
（コンテナ間は host=`db`、ホストからは `localhost`）。

---

## トラブルシュート

| 症状 | 対処 |
|---|---|
| ソース変更が反映されない | `WATCHPACK_POLLING=true` が効いているか確認。重い場合は `make restart` |
| `@prisma/client` が見つからない | `make generate`（named volume の node_modules に再生成） |
| 依存を更新したのに反映されない | `make down && make build && make up`（node_modules volume を作り直す場合は `make down-v`） |
| ポート 5432 が衝突 | ホストの別 Postgres を停止するか、`docker-compose.yml` の `db` ポートを変更 |
| DB をまっさらにしたい | `make down-v && make setup` |
