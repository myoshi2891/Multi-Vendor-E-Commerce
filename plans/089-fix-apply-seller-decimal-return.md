# Plan 089: applySeller が Decimal を含む Store 行をクライアントへ返す不具合を直す

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW（戻り値の縮小のみ。呼び出し側は `response.id` だけを参照）
- **Category**: bugfix
- **Planned at**: commit `35d52c65`, 2026-10-12

## Why this matters

2026-10-12 の実route受け入れ（専用DB `multivendor_e2e`・実Cloudinary）で出店申請を送信すると、
ブラウザーに `Only plain objects can be passed to Client Components from Server Components. Decimal objects are not supported.`
が 4 回出た。`applySeller`（`src/queries/store.ts`）が `db.store.create()` の結果をそのまま返し、
`Decimal(12,2)` の配送料 4 列（`defaultShippingFeePerItem` / `ForAdditionalItem` / `PerKg` / `Fixed`）が
Server Action の戻り値としてシリアライズされるため。申請保存は成功するが、
クライアントへ不要な店舗データ（内部列を含む）を渡している。

## 対象・受け入れ条件

- `applySeller` は `db.store.create({ ..., select: { id: true } })` で作成し、`{ id: string }` だけを返す。
- 入力 allowlist（`pickSellerEditableStoreFields`）、特権フィールドの上書き、重複検査、認可、エラー文言は変えない。
- 呼び出し側（`step-3.tsx` の `response.id`）は無変更で動く。`tsc` が通る。
- 実route の申請送信でコンソールの Decimal エラーが 0 件。

## 対象外

DB schema、他の query の戻り値、申請 UI。

## TDD・検証

1. Red: `src/queries/store.test.ts` の applySeller 正常系に「`select: { id: true }` で作成し `{ id }` だけを返す」を追加し、失敗を確認。
2. Green: `applySeller` に `select` を追加。既存の `toEqual(createdStore)` 期待値を新契約に合わせる。
3. 検証: 関連 Jest、`bunx tsc --noEmit`、`bun run lint`、実route（:3132・専用DB）で申請送信しコンソールエラー 0 を確認、後片付け。
4. 文書: `specs/multi-vendor-ecommerce/04-interfaces.md` に戻り値を明記。テスト数が変われば spec-sync-after-test。

## チェック

- [x] Red（新規1件が `select` 未指定で失敗）
- [x] Green（store/seller-apply 2 suites 82/82、tsc 0、lint 0）
- [x] 実route 確認（申請送信でDecimalのコンソールエラー0、Store削除済み）
- [x] 文書同期
