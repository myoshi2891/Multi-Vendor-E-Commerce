# Docker 開発環境コマンド集約
#
# 代表的な流れ:
#   make setup   # 初回: build → up → DB 起動待ち → migrate → seed
#   make logs    # アプリのログを追う (http://localhost:3000)
#   make down    # 停止 (データは保持)
#   make down-v  # 停止 + ボリューム削除 (DB を完全リセット)
#
# 詳細は docs/development/docker-dev.md を参照。

COMPOSE := docker compose
APP := $(COMPOSE) exec app

.DEFAULT_GOAL := help

.PHONY: help up down down-v build restart ps logs sh psql \
        migrate migrate-deploy generate studio seed seed-e2e \
        lint test test-e2e setup

help: ## 利用可能なコマンド一覧を表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## --- 起動・停止 ---

up: ## コンテナをビルドしてバックグラウンド起動
	$(COMPOSE) up -d --build

down: ## コンテナを停止 (ボリューム/データは保持)
	$(COMPOSE) down

down-v: ## コンテナとボリュームを削除 (DB を完全リセット)
	$(COMPOSE) down -v

build: ## イメージを再ビルド
	$(COMPOSE) build

restart: ## アプリコンテナを再起動
	$(COMPOSE) restart app

ps: ## コンテナの状態を表示
	$(COMPOSE) ps

logs: ## アプリのログを追従表示
	$(COMPOSE) logs -f app

## --- シェル ---

sh: ## アプリコンテナでシェルを開く
	$(APP) bash

psql: ## DB コンテナで psql を開く
	$(COMPOSE) exec db psql -U dev -d multivendor_dev

## --- Prisma ---

migrate: ## マイグレーション適用 (開発用 migrate dev)
	$(APP) bunx prisma migrate dev

migrate-deploy: ## マイグレーション適用 (履歴のみ migrate deploy)
	$(APP) bunx prisma migrate deploy

generate: ## Prisma クライアント再生成
	$(APP) bunx prisma generate

studio: ## Prisma Studio を起動 (http://localhost:5555)
	$(APP) bunx prisma studio --port 5555 --hostname 0.0.0.0

## --- データ ---

seed: ## ラグジュアリーデータセットを投入 (seed:luxury)
	$(APP) bun run seed:luxury

seed-e2e: ## E2E 用シードデータを投入 (seed:e2e)
	$(APP) bun run seed:e2e

## --- 品質 ---

lint: ## ESLint を実行
	$(APP) bun run lint

test: ## Jest ユニットテストを実行
	$(APP) bun run test

test-e2e: ## Playwright E2E テストを実行
	$(APP) bunx playwright test

## --- 初期化 ---

setup: up ## 初回セットアップ (up → DB 起動待ち → migrate → seed)
	@echo "==> DB の healthcheck 完了を待機..."
	@until [ "$$($(COMPOSE) ps -q db | xargs docker inspect -f '{{.State.Health.Status}}')" = "healthy" ]; do \
		sleep 2; \
	done
	@echo "==> マイグレーション適用"
	$(APP) bunx prisma migrate deploy
	@echo "==> シード投入"
	$(APP) bun run seed:luxury
	@echo "==> 完了: http://localhost:3000"
