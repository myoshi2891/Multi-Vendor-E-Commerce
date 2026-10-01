# カート同期: DB から消えた商品で全体が 500 になる問題の修正

## Context

`/cart` を開くと `updateCartWithLatest`（`src/queries/user.ts:1019`）が localStorage のカートを DB と照合する。
1 件でも `productId / variantId / sizeId` が DB に無いと `throw` し、`Promise.all` ごと失敗 → Server Action が 500、
`container.tsx` は `console.error` するだけで **残りの正常な商品の価格・在庫も更新されない**（古い金額表示が残る）。
開発環境では E2E シードが Size を毎回作り直すことで顕在化したが、本番でも販売者が商品/サイズを削除すれば同じことが起きる。
Playwright で「存在しない sizeId だけ」入れたカートで再現済み。

**方針**: 見つからない明細は例外にせず **結果から除外**し、残りは通常どおり同期する。
クライアントは件数差で除外を検知し、react-hot-toast で 1 回通知する（ユーザー選択済み）。
E2E シードの修正は今回のスコープ外（ユーザー選択済み）。

## 変更内容

### 1. `src/queries/user.ts` — `updateCartWithLatest`
- `if (!found) throw ...` を `return null` に変更（`// return cartProduct` のコメントは削除）。
- `Promise.all` の結果を型ガードで `CartProductType[]` に絞る（`(item): item is CartProductType => item !== null`）。`any`・`!` は使わない。
- 除外した件数があれば `console.warn("[User:updateCartWithLatest] Removed stale cart items", { count })` を出す
  （tech.md の 2 引数構造化ログ形式。ID 以外の個人情報は出さない）。
- 戻り値の型 `Promise<CartProductType[]>` は変えない（API 互換）。JSDoc に「存在しない明細は除外して返す」を追記。
- `saveUserCart` / `placeOrder` の厳格な例外は**変えない**（注文時は不整合を黙って通すべきでないため。cart ページで先に除外されるので通常は到達しない）。
- `variant.images[0].url` の既存挙動（L207 のコメントで意図的に維持）は触らない。

### 2. `src/components/store/cart-page/container.tsx`
- 同期成功時、`updatedCart.length < cartItems.length` なら
  `toast.error("Some items are no longer available and were removed from your cart.")` を表示
  （UI 文言は既存のカート画面に合わせて英語）。`import toast from 'react-hot-toast'`（`apply-coupon.tsx` と同じ）。
- `setCart(updatedCart)` は従来どおり → Zustand persist 経由で localStorage からも消え、合計も `setCart` 内で再計算される。
- 全件除外で空配列になった場合は `setCart([])` → 既存の `EmptyCart` 表示に落ちることをテストで確認。
- `Toaster` は `src/app/(store)/layout.tsx` にマウント済み。

## TDD（Red → Green）

1. **Red**: `src/queries/user.test.ts` の `describe("updateCartWithLatest")`
   - 既存 2 件（L1808「商品が見つからない場合エラーをスローする」/ L1819「バリアントが…」）を「除外して返す」に書き換え。
   - 追加: サイズが見つからない場合も除外 / 正常 1 件 + 不明 1 件 → 正常 1 件だけ返る / 全件不明 → `[]`、`console.warn` が呼ばれる。
2. **Red**: `tests/component/store/cart-container.test.tsx`（`react-hot-toast` は `apply-coupon-form.test.tsx` と同じ形で mock）
   - 返却件数が減ったら `toast.error` が 1 回呼ばれ、`setCart` に減った配列が渡る。
   - 件数が同じなら `toast.error` は呼ばれない。
3. **Green**: 上記 1・2 を実装。

## 手順・文書

- 実装前に `plans/070-cart-sync-drop-stale-items.md` として本計画を保存（`.claude/rules/04` の計画先行ルール）。
- テスト数が変わるため `spec-sync-after-test` skill を起動（QA_HANDOFF.md → 07-testing.md / COVERAGE_REPORT.md / PROGRESS.md、`bun run coverage:dashboard`）。
- 仕様: `specs/multi-vendor-ecommerce/04-interfaces.md` の `updateCartWithLatest` 記述があれば「不明な明細は除外」に更新。
- コミットはユーザー依頼時のみ（依頼されたら Red / Green / docs 同期を別コミット）。

## 検証

- `bun run test -- src/queries/user.test.ts tests/component/store/cart-container.test.tsx`（Red で意図した失敗 → Green で成功）
- `bunx tsc --noEmit` と `bun run lint`（`test-complete` skill）
- 実機: Playwright で localStorage に「存在する明細 + 存在しない sizeId の明細」を入れて `/cart` を開き、
  500 が出ないこと・正常な 1 件だけ表示されること・トーストが出ること・localStorage から不明明細が消えることを確認。
  最後にテスト用の `cart` は削除する。
