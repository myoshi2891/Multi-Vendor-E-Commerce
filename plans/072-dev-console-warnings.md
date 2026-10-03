# 072. 開発時コンソール警告の解消（Clerk createRouteMatcher 廃止 / 構造依存 CSS / スクロールコンテナ）

## Context

`bun run dev` とブラウザコンソールに出る警告を整理した（2026-10-02）。

| # | 警告 | 原因 | 方針 |
|---|---|---|---|
| A | Clerk `createRouteMatcher` is deprecated | `src/proxy.ts` がパスマッチで `auth.protect()` していた | リソース側（layout/page）で認証し、proxy の保護を外す |
| B | Clerk Structural CSS `.user-avatar .cl-avatarBox` | `globals.css` に同一ルールが 2 箇所 | `UserButton` の `appearance.elements.avatarBox` へ移行 |
| C | framer-motion "container has a non-static position" | `useScroll({ target })` の既定 container（`<html>`）が `position: static` | `html { position: relative }` |
| D | `THREE.Clock` deprecated | `@react-three/fiber@9.8.1`（最新）内部 | 対応しない（tech.md の未対応警告表に記載） |
| E | Clerk dev keys / telemetry | 開発インスタンスの情報表示 | 対応しない |

## A の前提確認（リソース側の認証）

- `/dashboard` → `dashboard/page.tsx` が `currentUser()` で振り分け済み
- `/dashboard/admin/*` / `/dashboard/seller/*` → layout で role 検証済み
- `/checkout` → page で未ログイン時 redirect 済み
- `/profile/*` → **proxy のみに依存** → `ProfileLayout` に `auth()` + `redirectToSignIn()` を追加
  （`auth.protect()` と同じく sign-in へ遷移させる UX を維持）。データ取得側（`src/queries/profile.ts` 等）は従来から `currentUser()` で検証している。

## TDD

1. Red: `tests/component/store/profile-layout.test.tsx` — 未認証で `redirectToSignIn` が呼ばれ描画しない / 認証済みで children を描画。
   `src/middleware.test.ts` — どのパスでも `auth.protect()` を呼ばない（パスマッチ保護の撤去を固定）。
   `tests/component/store/user-menu.test.tsx` — `UserButton` に `appearance.elements.avatarBox` を渡す。
2. Green: `profile/layout.tsx` / `proxy.ts` / `user-menu.tsx` / `globals.css` を修正。

## Done criteria

- `bun run test` / `bunx tsc --noEmit` / `bun run lint` が通る
- dev サーバー起動・ホーム表示で警告 A/B/C が出ない
- 未認証で `/profile/orders` → sign-in へ遷移
- CLAUDE.md / tech.md / structure.md の `src/middleware.ts`・middleware 保護の記述を同期

## 実施結果

- 2026-10-02 実装・検証済み（未コミット）。Red 7 件（middleware 5・profile layout 1・user-menu 1）を確認後に Green。
- Jest 全体 2624 passed / 2627 total・247 スイート、`tsc --noEmit` 0 件、lint エラー 0（既存警告 12 件のみ）。
- 起動中の dev サーバーで確認: 未認証 `/profile/orders` → `/sign-in?redirect_url=...`、`<html>` の computed position が `relative`、ホームのコンソールには `THREE.Clock`（対応外）のみ。
- 警告 B（構造依存 CSS）はサインイン時に `UserButton` が描画されて初めて出る。検出対象のセレクタは globals.css から削除済み（ログインした状態での目視確認は未実施）。
- 既存の別件: `user-menu.test.tsx` の jsdom で `<div>` cannot be a descendant of `<p>` の警告が出る（変更前から発生）。
