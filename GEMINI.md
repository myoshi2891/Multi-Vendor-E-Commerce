# GEMINI.md

This file provides guidance to Antigravity (Google's agentic IDE) when working with code in this repository.
Antigravity reads this file at the start of every agent session to maintain persistent context.

## プロジェクト概要

マルチベンダーEコマースマーケットプレイス。Next.js 14 (App Router) + TypeScript + Prisma (PostgreSQL) + Clerk認証 + Stripe/PayPal決済。3つのユーザーロール: 顧客 (USER)・販売者 (SELLER)・管理者 (ADMIN)。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript strict mode |
| UI | Tailwind CSS + shadcn/ui |
| 認証 | Clerk |
| DB | PostgreSQL (Neon) + Prisma ORM + Prisma Accelerate |
| 決済 | Stripe / PayPal |
| 画像 | Cloudinary |
| 状態管理 | Zustand（カート） |
| テスト | Jest (ユニット) + Playwright (E2E) |
| パッケージマネージャー | Bun |

## 開発コマンド

```bash
bun run dev                    # 開発サーバー起動
bun run build                  # 本番ビルド
bun run lint                   # ESLint
bun run test                   # Jest ユニットテスト
bunx playwright test           # Playwright E2E
bunx prisma generate           # Prismaクライアント再生成
bunx prisma migrate dev        # マイグレーション適用
bunx prisma studio             # DBブラウザ
```

## エージェント行動方針

- タスク開始前に必ず `specs/multi-vendor-ecommerce/` で仕様を確認する
- コードを一行も書く前に実装プランを生成し、ユーザーに確認を求める
- 不確実な場合は実装前に確認（"Always Proceed" 禁止）
- git commit はタスク単位で細かく行う
- `console.log()` のコミット禁止
- 本番DBへの `DELETE`/`DROP` は人間確認なしに実行しない

## ルール参照

- コアルール: `.agent/rules/core.md`（常時有効）
- TypeScript規約: `.agent/rules/typescript.md`（`.ts/.tsx` ファイル時に有効）

## 知識ベース参照

プロジェクト固有の慣習・既知の問題は `.context/` 配下に蓄積する（存在する場合）。

## 仕様書参照

新機能を実装する前に必ず以下を確認すること:

1. `specs/multi-vendor-ecommerce/00-overview.md` — プロダクトのスコープ
2. `specs/multi-vendor-ecommerce/01-requirements.md` — 機能・非機能要件
3. `specs/multi-vendor-ecommerce/02-architecture.md` — アーキテクチャ制約
4. `specs/multi-vendor-ecommerce/03-data-model.md` — データモデル
5. `specs/multi-vendor-ecommerce/07-testing.md` — テスト方針

実装後は実装内容と仕様書の乖離がないか確認し、乖離があれば人間に報告する。
