# バリアント編集の行ID表示不具合の修正（DS-PAGE-059）

- 日付: 2026-10-13
- 承認: P3残存8画面の実route受け入れ後、ユーザーが推奨作業（本不具合の修正と059の再受け入れ）を依頼。
- 関連: [P3計画の追補](priority-eight-p3-residual-design-system-plan.md#追補-認証後実route受け入れ2026-10-13) / [QA](../../docs/testing/QA_HANDOFF.md#ds-p3-residual-eight-routes)

## 事象と原因

実データのバリアント編集で、色・サイズ・仕様の各行先頭に行UUIDが入力欄として表示される。

- `getProductVariantForEdit`（`src/queries/product.ts`）が colors / sizes / product_specs / variant_specs / questions の各行に DB の `id` を含めて返す（`a3a84de1` から）。
- `ClickToAddInputs`（`src/components/dashboard/forms/click-to-add.tsx`）は `Object.keys(detail)` の全キーを入力欄として描画する。
- 保存側（`upsertProduct` の更新経路）はこれらを全削除→再作成しており、行 `id` を使わない。追加画面用の `getProductMainInfo` も `id` を返さない。
- 既存単体テストは `id` 付きの戻り値を期待値として固定していた。

## 対応

編集用クエリが返すフォーム初期値から、上記5項目の行 `id` を除く（`getProductMainInfo` と形を揃える）。`ClickToAddInputs` の汎用描画、保存処理、images / freeShippingCountriesIds の形、公開API、DB schema は変更しない。

## TDD・受け入れ条件

- Red: `src/queries/product-edit.test.ts` の期待値を `id` なしへ訂正し、失敗を確認する。
- Green: クエリのマッピングから `id` を除く。関連Jest（product-edit / 商品ページdesign / click-to-add / product）を通す。
- 実route: `p3-residual-route` のバリアント編集操作に「色・サイズ・仕様の入力欄にUUID形式の値が無いこと」を追加し、suite 全体を再実行する。059の画像を目視する。
- `bunx tsc --noEmit`、`bun run lint`、`bun run check:playwright`、diff check。テスト件数は変わらないため全体統計は再計測しない（件数が変わる場合は spec-sync-after-test）。
- Integration（`tests/integration/category-attributes.test.ts` の編集往復）は専用DBが必要なため、今回実行しない場合は理由を記録する。

## 文書

進捗ノートの059を検証済みへ更新、QA_HANDOFF の保留を解除、本計画のチェックを更新。業務契約・API・データモデルは不変のため SDD の interfaces / data-model は変更不要。

## 実施チェック

- [x] Red（期待値訂正で1件失敗）
- [x] Green / Refactor（関連Jest 110/110、Integration 編集往復 2/2）
- [x] 実route再受け入れ（`p3-residual-route` 54/54）
- [x] 文書同期
