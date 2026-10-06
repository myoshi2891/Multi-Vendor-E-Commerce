# Plan 082: E2E の古いセレクター追従 + 適用済みマイグレーション編集の是正

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW（本番 DB は未稼働。マイグレーションはデータのみで DDL を含まない）
- **Depends on**: 081
- **Category**: bug
- **Planned at**: commit `05047e90`, 2026-10-07

## Why this matters

plan 081 の E2E 確認で 7 件の失敗が「HEAD でも同じく失敗する既存の失敗」として記録されたが、
原因は特定されていなかった。調査の結果、2 つの独立した問題が見つかった。

1. **E2E が UI 文言の変更に追従していない。** `d3e87f64`（2026-09-29・商品ページのデザイン移行）で
   - カート追加のトーストが `"Product added to cart successfully!"` → `"Added to your bag"`
   - 商品ページの StoreCard が `editorial` 版になり、フォローボタンが `"Follow boutique"`、
     フォロワー数が `<strong>N</strong>` → `<span>N followers</span>`

   に変わったが、E2E は旧文言のまま。7 件の他に、未実行の 4 spec（mobile-responsive /
   payment-error / stock-decrement / profile）にも同じ旧文言が残る。
2. **適用済みマイグレーションの編集。** `0ffb72b8`（2026-09-05）が
   `20260901223148_category_tree_phase_b_resync/migration.sql` に url 交換用の一時退避を追加した。
   同マイグレーションは 2026-09-02 に適用済みのため、チェックサムが不一致になり
   `migrate dev` がリセットを要求する（plan 081 で発生）。新規 DB と既存 DB で実行された SQL も食い違う。
   `tech.md` 禁止事項「`prisma/migrations/` 配下の既存ファイルを編集する」に違反している。

## Scope

- `tests/e2e/{purchase-flow,platform-coupon,mobile-responsive,payment-error,stock-decrement,profile}.spec.ts`:
  トースト待ちを `/Added to your bag/i` へ
- `tests/e2e/engagement.spec.ts`: フォローボタンを `"Follow boutique"`、フォロワー数を `N followers` から読む
- `prisma/migrations/20260901223148_category_tree_phase_b_resync/migration.sql`: `5c4b2501` の内容へ戻す
- `prisma/migrations/20261007120000_category_tree_resync_url_swap/migration.sql`（新規・補正）:
  一時退避 + 再同期ループ + childCount 再計算を `RESYNC_URL_SWAP` 区間として持つ
- `tests/integration/category-tree-resync.test.ts`: url 交換のテストを補正マイグレーションの区間へ向け、
  「旧再同期で片側がずれた状態を補正が直す」「補正は冪等」を検証する

## Out of scope

- トーストへの `data-testid` 付与（`src` の変更が要る。文言依存の解消は別計画）
- 本番 DB への適用（未稼働のため不要。稼働時は通常の `migrate deploy` で入る）

## Steps / Verify

1. **Red**: phase_b を元へ戻し、統合テストの url 交換ケースが失敗することを確認する
2. **Green**: 補正マイグレーションを追加し、テストを補正区間へ向けて `bun run test:integration` が全件 pass
3. ローカル Docker DB で `bunx prisma migrate status` がチェックサム不一致を報告しないこと、
   `bunx prisma migrate deploy` で補正 1 本が適用されること
4. E2E を修正し、`bun run test:e2e:local -- --project=chromium <7 spec>` が pass（OI-13 / OI-14 / E2E-AUTH 該当は区別）
5. `bunx tsc --noEmit` / `bun run lint` / `bun run test`

## Done criteria

- [x] phase_b の `migration.sql` が `5c4b2501` とバイト一致（sha256 `bd3152ca…` = ローカル DB の記録値）
- [x] 統合テストが pass（Red: 元の版で url 交換ケースが `electronics-audio` にずれて失敗 → Green: 223/223）
- [x] 報告の 7 件（purchase-flow 5・engagement 1・platform-coupon 1）が Chromium で pass
- [x] QA_HANDOFF / plans/README / plan 081 の記録を更新

## 実施結果（2026-10-07）

- ローカル Docker DB: `migrate status` で不一致なし、`migrate dev` がリセットを要求せず補正 1 本を適用
- 追加で見つけた失敗: platform-coupon の注文詳細（`21924e9d` で `<dl>` 化）と payment-error:48（住所未選択の注記 `<p>` とトーストの二重一致）も修正。
  旧トースト文言の 4 spec（mobile-responsive / payment-error / stock-decrement / profile）も更新
- 範囲外として QA_HANDOFF に登録: OI-17（未認証 `/checkout` の遷移先）、OI-18（profile の Country 一意制約衝突）。OI-14（mobile-responsive の `GoShop`）は既知
- Neon（未稼働）には補正 1 本が未適用。稼働時の `migrate deploy` で入る
- Jest 2919/2922・Integration 223/223・tsc 0・lint 0 errors

## 追補: OI-17 / OI-18（2026-10-07）

- **OI-17**: 未認証の `/checkout` の正しい遷移先は sign-in（ユーザー判断）。`checkout/page.tsx` を `auth()` + `redirectToSignIn()`
  （`profile/layout.tsx` と同じ形）に変更。`tests/component/store/checkout-page-auth.test.tsx` +2（旧実装条件で `/cart` へ redirect される Red → Green）
- **OI-18**: `profile.spec.ts` の実国名 fixture（`Country.name` UNIQUE 衝突）を撤去し、seed の project 別の国を選ぶ
- 検証: Jest 2921/2924・tsc 0・lint 0 errors、Chromium E2E（payment-error / profile / platform-coupon / purchase-flow）10 passed
- `visual/checkout.spec.ts` は redirect が通るようになったが、ベースラインが旧 GoShop デザインのため差分で失敗する（OI-13 で撮り直す）
