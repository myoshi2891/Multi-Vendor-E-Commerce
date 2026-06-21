#!/usr/bin/env bash
#
# ローカル Postgres に対して Playwright E2E を実行する opt-in ラッパー。
#
# 背景:
#   既定の `bunx playwright test` は Bun の `.env` 自動ロードにより Neon の DATABASE_URL を
#   解決する。Neon + Prisma Accelerate の負荷下間欠ハングが重い注文フロー（sign-in →
#   cart → checkout → place order）の goto を 90s 超ハングさせ、ローカルでは retries:0 の
#   ため救済されず、run ごとに別テストへ移動する環境 flake になる。
#
# 本スクリプトは DB URL のみをローカル docker Postgres に上書きして flake を根絶する。
# Clerk/Stripe 等のキーは export せず `.env` から従来通り供給される。
#
# 使い方:
#   bun run test:e2e:local                                   # 全 E2E
#   bun run test:e2e:local -- tests/e2e/stock-decrement.spec.ts   # 単一スペック
#
# 注意:
#   playwright.config.ts は reuseExistingServer:!CI のため、:3000 に Neon 向き dev サーバーが
#   起動中だと再利用される。本スクリプト実行前に :3000 の既存サーバーを停止すること。
#
set -euo pipefail

# 非シークレット: docker-compose.yml の db サービスと一致するローカル接続情報。
readonly LOCAL_DB_URL="postgresql://dev:dev@localhost:5432/multivendor_dev"

cd "$(dirname "$0")/../.."

echo "==> ローカル Postgres (db サービス) を起動..."
docker compose up -d db

echo "==> DB の healthcheck 完了を待機..."
until [ "$(docker compose ps -q db | xargs docker inspect -f '{{.State.Health.Status}}')" = "healthy" ]; do
    sleep 2
done

# DB URL のみローカルへ上書き（Bun/Next とも先行 export を .env より優先）。
export DATABASE_URL="$LOCAL_DB_URL"
export DIRECT_URL="$LOCAL_DB_URL"
export E2E_DATABASE_URL="$LOCAL_DB_URL"

echo "==> マイグレーション適用 (migrate deploy)..."
bunx prisma migrate deploy

echo "==> E2E シード投入 (seed:e2e)..."
bun run seed:e2e

echo "==> Playwright E2E 実行 (ローカル Postgres)..."
bunx playwright test "$@"
