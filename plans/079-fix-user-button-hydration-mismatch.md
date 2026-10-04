# 079: UserMenu の Clerk `UserButton` hydration 不一致を解消する

## Context

ストアヘッダーの `UserMenu`（async Server Component）が描画する Clerk `<UserButton>` で、
開発時に `Hydration failed because the server rendered HTML didn't match the client` が断続的に出る。

- `@clerk/react` の `withClerk` は `if (!clerk.loaded) return null`（`hooks-*.mjs`）で描画を分岐する。
- `clerk.loaded` は React state ではなく `this.clerkjs?.loaded` を読む**ライブ getter**（`ClerkProvider-*.mjs`）。
- SSR では常に `false` → 何も出力しない。クライアントでは、ストリーミングされた `UserMenu` の
  hydration より先に clerk-js のロードが終わっていると `true` → `<div data-clerk-component="UserButton">`
  を描画し、サーバー HTML と食い違う（タイミング依存のため断続的）。
- `<ClerkLoaded>` も同じ getter を参照するため解決にならない。

併せて `next-themes@0.3.0` の `<script>` 警告（React 19.2 の dev 警告）は実害がないため、
`tech.md` の「意図的に未対応の Next.js 16 警告」に記録して対応外とする。

## 方針

- `user-menu/client-user-button.tsx`（Client Component）を新設し、
  `useSyncExternalStore(subscribe, () => true, () => false)` で「SSR / hydration 中は `null`、
  hydration 完了後に `UserButton`」を描画する。server snapshot を使うので hydration は必ず一致する。
- `user-menu.tsx` の `<UserButton>` をこのラッパーに置き換える。`appearance.elements.avatarBox` は維持。
- 外部依存の追加・バージョン変更はしない。

## 受け入れ条件

- `renderToString(<ClientUserButton />)` が `UserButton` を含まない。
- SSR 文字列を `hydrateRoot` しても `onRecoverableError` が呼ばれず、hydration 後に `UserButton` が描画される。
- 既存 `tests/component/store/user-menu.test.tsx` が全件 pass（アバターサイズ指定の検証を含む）。
- `tech.md` の警告表に next-themes の `<script>` 警告を追記。

## 検証

- Red: ラッパーを `UserButton` 直描画のスタブで作り、SSR テストが失敗することを確認。
- Green: `useSyncExternalStore` 実装で pass。
- `bunx jest tests/component/store/client-user-button.test.tsx tests/component/store/user-menu.test.tsx`、
  `bunx tsc --noEmit`、`bun run lint`、全体 `bun run test` の実測値で統計を同期。
