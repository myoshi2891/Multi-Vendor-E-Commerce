#!/usr/bin/env bash
#
# ローカル Postgres に対して Playwright E2E を実行する opt-in ラッパー。
#
# 背景:
#   既定の `bunx playwright test` は Bun の `.env` 自動ロードにより Neon の DATABASE_URL を
#   解決する。重い注文フロー（sign-in → cart → checkout → place order）が間欠的に 120s
#   ハングし、失敗が run ごとに別テストへ移動する。
#
#   当初は Neon 負荷が原因と仮説したが、ローカル Postgres へ向けても flake は再現した
#   （3 run 中 1 run で platform-coupon が 120s ハング）。よって DB は真因ではなく、ハングは
#   sign-in 後のブラウザ側ナビゲーションの問題である。
#
#   【2026-08-03・plan 047 で真因を特定】この 120s ハングの正体は
#   `waitForPostSignInSettle`（サインイン後の networkidle 待ち）だった。これを通すと後続の
#   `page.goto` がリクエストを 1 件も発行しないままハングし、per-goto 予算 × リトライを
#   丸ごと消費する（同時刻にシェルから同 URL を curl すると 0.5〜1.5s で 200 が返る）。
#   注文フロー spec から除去済みで、同一フローは 9〜11s で完走する。新規 spec でも
#   サインイン直後にこのヘルパーを挟まないこと（`gotoStable` は Firefox の
#   NS_BINDING_ABORTED 吸収に必要なので残す）。
#
#   本スクリプトの狙いは:
#     (1) Neon/Accelerate を変数から外す（クラウド到達性に E2E を依存させない）
#     (2) CI と同じ retries で間欠ハングを吸収する（CI=retries:2 / ローカル既定=0）
#   詳細は docs/development/docker-dev.md を参照。
#
# DB URL のみをローカル docker Postgres に上書きする。
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
# 最大 60s（30 回 × 2s）待機。コンテナ ID が空の間は docker inspect をスキップし、
# set -e による即時終了と、healthy にならない場合の無限ハングの両方を防ぐ。
readonly DB_HEALTH_MAX_RETRIES=30
db_health_attempt=0
until
    db_cid="$(docker compose ps -q db)"
    [ -n "$db_cid" ] &&
        [ "$(docker inspect -f '{{.State.Health.Status}}' "$db_cid")" = "healthy" ]
do
    db_health_attempt=$((db_health_attempt + 1))
    if [ "$db_health_attempt" -ge "$DB_HEALTH_MAX_RETRIES" ]; then
        echo "ERROR: db サービスが ${DB_HEALTH_MAX_RETRIES} 回（約 60s）待機しても healthy になりませんでした。" >&2
        exit 1
    fi
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

echo "==> Playwright E2E 実行 (ローカル Postgres, retries=2 で CI と同じ flake 吸収)..."
bunx playwright test --retries=2 "$@"
