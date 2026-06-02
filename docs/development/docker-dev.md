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

## ローカル SonarQube（静的解析）

CI（SonarCloud）と同等の静的解析をローカルで再現する。アプリ本体スタックとは
サービス名・ポート（9000）・ボリュームすべて分離しており**同時起動可能**。
構成: [`docker-compose.sonar.yml`](../../docker-compose.sonar.yml)（SonarQube Community +
専用 PostgreSQL + scanner-cli。全イメージ digest 固定）。設計判断は
[ADR-005](../architecture/decisions/005-sonarqube-static-analysis.md) を参照。

```bash
# 1. SonarQube を起動（起動完了まで 1〜2 分）
make sonar-up
#    → http://localhost:9000 を開き admin/admin でログイン → 初回パスワード変更
#    → My Account → Security でトークンを発行し .env.docker の SONAR_TOKEN に設定

# 2. ホスト側でカバレッジを生成（lcov を scanner が取り込む）
bun run test -- --coverage     # coverage/lcov.info を出力

# 3. 解析を実行
SONAR_TOKEN=<発行したトークン> make sonar-scan
#    → http://localhost:9000 のプロジェクト multi-vendor-ecommerce に結果が表示される

# 4. 停止（データは保持。再起動時は再ログイン不要）
make sonar-down
```

| コマンド | 用途 |
|---|---|
| `make sonar-up` | SonarQube + 専用 DB を起動（http://localhost:9000） |
| `make sonar-scan` | scanner-cli で解析を実行（要 `SONAR_TOKEN`、事前に `--coverage`） |
| `make sonar-down` | 停止（ボリューム/データは保持） |

> **注意**: SonarQube は内部に Elasticsearch を持つため、ホストで `vm.max_map_count >= 524288`
> が必要。Docker Desktop (mac/win) は通常問題ないが、Linux では起動前に
> `sudo sysctl -w vm.max_map_count=524288` を実行する。
>
> CI（PR ごとの解析）は SonarCloud が担う。`.github/workflows/ci.yml` の `sonarcloud` ジョブは
> 非ブロッキングで、`SONAR_TOKEN` Secret 未登録時は skip される。

---

## トラブルシュート

| 症状 | 対処 |
|---|---|
| ページが 500 (`Publishable key not valid.`) | `.env.docker` の Clerk キーが stub のまま。実際の Clerk **test** キー（`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`）に差し替える |
| ソース変更が反映されない | `WATCHPACK_POLLING=true` が効いているか確認。重い場合は `make restart` |
| `@prisma/client` が見つからない | `make generate`（named volume の node_modules に再生成） |
| 依存を更新したのに反映されない | `make down && make build && make up`（node_modules volume を作り直す場合は `make down-v`） |
| ポート 5432 が衝突 | ホストの別 Postgres を停止するか、`docker-compose.yml` の `db` ポートを変更 |
| DB をまっさらにしたい | `make down-v && make setup` |

### シードは `bun` 直接実行（`tsx` を使わない）

`oven/bun` イメージには実 Node.js が無く `node` は Bun の fallback shim のため、`package.json` の
`tsx ...` スクリプト（`seed:luxury` / `seed:e2e`）はコンテナ内で動かない（`Cannot find module
'./cjs/index.cjs'`）。Makefile の `make seed` / `make seed-e2e` は `bun prisma/seed/seed.ts` のように
**bun で TS ファイルを直接実行**することで回避している（bun は TS / tsconfig paths をネイティブ解決）。
ホスト側 (`bun run seed:luxury`) は実 Node 経由の `tsx` で従来どおり動作する。
