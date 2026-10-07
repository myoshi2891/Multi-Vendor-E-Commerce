# Plan 083: seller 商品フォームの SSR `self is not defined`（OI-11）

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW（クライアント専用エディタの読み込み方法だけを変える）
- **Depends on**: —
- **Category**: bug
- **Planned at**: commit `05047e90`, 2026-10-07

## Why this matters

QA_HANDOFF の OI-11（最優先）: `/dashboard/seller` 系ルートを本番 SSR すると
`ReferenceError: self is not defined` が出る。

**原因の訂正。** OI-11 は `next-cloudinary` の `CldUploadWidget` を原因と推定していたが、誤りだった。

- `next-cloudinary` 6.16.0 とその依存（`@cloudinary-util/*`）の dist には `self` の参照が無い。
  `image-upload.tsx` は `isMounted` ゲートにより SSR 時には描画もしない。
- `jodit-react` 4.1.2 の `build/jodit-react.js` は UMD ラッパーが**モジュール評価時に** `}(self, …)` を実行する。
- `src/components/dashboard/forms/product-details.tsx` が `jodit-react` を静的に import しているため、
  seller の `products/new` / `variants/new` / `variants/[variantId]` の SSR でモジュールが評価される。
  `"use client"` でも SSR 時にモジュールは評価される（描画ゲートでは防げない）。

## Scope

- `src/components/dashboard/forms/product-details.tsx`: `jodit-react` を `next/dynamic` の `ssr: false` で読み込む
- `tests/component/dashboard/product-details-ssr.test.tsx`（新規）: `self` が無い node 環境で import できることを固定する
- `tests/component/dashboard/product-details.test.tsx`: エディタの取得を非同期（`findByTestId`）へ

## Out of scope

- `image-upload.tsx` / `upload-images.tsx`（原因ではない）
- plans 057 / 061 の OI-11 原因記述（過去の記録として残す）

## Steps / Verify

1. **Red**: 新規テストが現行コードで `self is not defined` により失敗することを確認する
2. **Green**: 動的 import へ置き換え、新規テストと既存の `product-details.test.tsx` が pass する
3. `bun run build` の前後で、`.next/server` のチャンクに jodit の UMD 先頭（`}(self,`）が含まれるかを比較する
4. `bunx tsc --noEmit` / `bun run lint` / `bun run test`

## Done criteria

- [x] Red → Green を確認した
- [x] サーバーのビルド成果物に jodit の UMD が含まれない
- [x] tsc 0・lint 0 errors・Jest 全体 pass
- [x] QA_HANDOFF の OI-11 を解消扱いにし、統計を同期した

## 実施結果（2026-10-07）

- 切り分け: `node -e "require('jodit-react')"` は `self is not defined`、`require('next-cloudinary')` は成功
- Red: 新規テストが旧実装で `ReferenceError: self is not defined` により reject。node 環境で `uuid` の ESM を Jest が変換できないため `uuid` のみモック（本番とは無関係）
- ビルド: 変更前は `.next/server/chunks/ssr/*.js` に jodit 本体（`jodit-react-container`）が含まれ、変更後はクライアントチャンクのみ
- Jest 2922/2925・304 スイート・tsc 0・lint 0 errors（警告 8 は既存で変更ファイル外）
- 未確認: seller でサインインした本番サーバーでの実ルート表示（Clerk 認証情報が必要）
