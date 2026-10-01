# 071. ローカル DB への Clerk ユーザー同期コマンド + お気に入りエラー表示の修正

## Context

`/cart` のお気に入りボタンで `PrismaClientKnownRequestError: Foreign key constraint violated: Wishlist_userId_fkey` が
トーストに生のまま表示された（2026-10-01）。

- **根本原因（環境）**: DB の `User` 行は Clerk Webhook（`src/app/api/webhooks/route.ts`）でのみ作られるが、
  Webhook はローカル Docker の Postgres に届かない。Clerk Backend API と照合した結果、Clerk の全ユーザーが
  ローカル DB に存在しなかった。お気に入りに限らず `userId` を参照する書き込み（カート保存・住所・注文等）が同じ理由で失敗する。
- **副次（表示）**: `src/components/store/cards/cart-product.tsx` の `handleAddToWishlist` が `catch (error: any)` +
  `toast.error(error.toString())` で、内部パスを含む Prisma エラーをそのまま表示していた（`any` 禁止にも違反）。

方針（ユーザー選択済み）: アプリのコードは変えず、**開発用の同期コマンド**でローカル DB に Clerk ユーザーを upsert する。
表示はあわせて修正する。

## 変更内容

### 1. 同期コマンド（開発専用）
- `scripts/dev/clerk-user-mapping.ts`（純粋関数）: Clerk API のユーザー JSON（`unknown`）を型ガードで検証し、
  `{ id, name, email, picture, role }` に変換する Result を返す。
  - email はプライマリ（`primary_email_address_id` 一致）→ 先頭の順。無ければ失敗（Webhook と同じく作らない）。
  - name は first/last の空でない部分を結合、無ければ email のローカル部（Webhook の `"null null"` 問題を避ける）。
  - role は `private_metadata.role` が `USER|ADMIN|SELLER` ならそれ、以外は `USER`。
    認可ガードは Clerk の metadata を見るため、ローカル DB の role をそれに揃える。
- `scripts/dev/sync-clerk-users.ts`（CLI）: `CLERK_SECRET_KEY` で `GET https://api.clerk.com/v1/users` をページング取得し、
  `PrismaClient` で 1 件ずつ upsert（create / update とも上記フィールド）。1 件の失敗（email 重複等）は
  ログに件数とユーザー ID だけ出して続行し、失敗があれば exit 1。**Clerk へは書き戻さない**（共有の dev インスタンスを変更しない）。
  `DATABASE_URL` のホストが `localhost` / `127.0.0.1` / `db` 以外なら中止する（Neon 等の共有 DB への誤実行防止）。
- `Makefile`: `sync-clerk-users` ターゲット（`$(APP) bun scripts/dev/sync-clerk-users.ts`。seed と同じく bun 直接実行）。
- `docs/development/docker-dev.md`: トラブルシュートに `Foreign key constraint violated: *_userId_fkey` → `make sync-clerk-users` を追記。

### 2. `cart-product.tsx` のエラー表示
- `catch (error: unknown)` + 型ガード。`"Product is already in the wishlist."` のみそのまま表示し、
  それ以外は固定文言 `"Failed to add product to wishlist"`（内部エラーを表示しない）。

## TDD

1. Red: `scripts/dev/clerk-user-mapping.test.ts` — 正常変換 / プライマリ email 選択 / email 無し→失敗 /
   名前欠落→email ローカル部 / 不正 role→USER / 非オブジェクト入力→失敗。
2. Red: cart-product のコンポーネントテスト — Prisma 風エラーで固定文言、重複エラーでその文言。
3. Green: 実装。

## 検証

- 対象テスト → 全テスト、`bunx tsc --noEmit`、`bun run lint`。
- `make sync-clerk-users` を実行し、Clerk ユーザーがローカル DB に入ったことを件数で確認。
- ブラウザでお気に入り追加が成功することはユーザーに確認を依頼（ログイン状態が必要なため）。
- テスト数が変わるので `spec-sync-after-test` で文書同期。コミットは依頼時のみ。
