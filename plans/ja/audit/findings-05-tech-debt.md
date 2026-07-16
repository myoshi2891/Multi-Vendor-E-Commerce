# Findings 05 — Tech Debt & Architecture（raw・未 vet）

> 原本: [../../audit/findings-05-tech-debt.md](../../audit/findings-05-tech-debt.md)

> Explore サブエージェント報告（2026-07-03 / HEAD `f9752c0`）。**Phase 3 の vet 前の生データ**。
> プレイブック（§5 / Finding format / Prioritization rubric）と recon.md の読了確認済み。既報の index/search 重複（SECURITY-05/PERF-11）・order-table-cells 集約済み・Elasticsearch コメントアウト・既知課題（OI-9/10/11、applyCoupon ロストアップデート等）は除外済み。
> **レイヤリング検査の注記**: UI ファイルが `@/queries/*` を import する箇所（約40件）は「クライアントコンポーネントが server action を呼ぶ」標準 Next.js パターンであり、規約4は「action は `src/queries/` に**住む**」ことを求めるもの — 違反として報告しない。`db.ts` 外の `new PrismaClient()` なし。プロンプトインジェクション様コンテンツ・秘密値の再現なし。

### [TECHDEBT-01] `src/queries/` の3系統に分裂したエラーログ形式を単一ヘルパーに集約

- **Evidence**:
  - 正準の構造化形式（規約3: `console.error("[Module:Function] msg", { error, stack })`）: `src/queries/dashboard.ts:84`、`message.ts:263`、`order.ts:347`、`inventory.ts:78`、`support.ts:65`。
  - レガシー3引数形式（`console.error("Error in X:", error.message, error.stack)` + 手書き `instanceof Error` 分岐の複製）: `src/queries/category.ts:65-67`、`store.ts:150-152`、`product.ts:116-118`、`user.ts:86-88`、`subCategory.ts:70-72`、`offer-tag.ts:66-68` — 同型ペアが queries 全体で約90箇所。
  - タグなし裸形式（`console.error(error)`、`[Module:Function]` なし）: `src/queries/coupon.ts:54, 92, 130, 158, 195, 332`。
- **Impact**: 3形式の混在はログ集約/アラートを無力化（`[Module:Function]` ベースの検索がレガシー/裸サイトを取りこぼす）。churn 1位の `coupon.ts` の裸サイトはモジュールタグも stack も落とし、クーポン経路のインシデント調査を阻害。`instanceof Error ? … : …` ブロックが約90回手コピーされており、`logError(tag, error)` 抽象の欠落。
- **Effort**: M / **Risk**: LOW（ログのみ。リスクは `console.error` の引数形状を assert する単体テスト） / **Confidence**: HIGH
- **Fix sketch**: `src/lib/` に `logError(tag: string, error: unknown, ctx?)` を追加して `instanceof Error` 分岐を正規化し2引数形式で出力 → 約100 catch ブロックを機械的置換 → `coupon.ts`(32-332) に同ファイル新関数群(361-480)が既に使うタグを採用させる。

### [TECHDEBT-02] `product-details.tsx` god component（1382行）の分割

- **Evidence**: `src/components/dashboard/forms/product-details.tsx:1-1382` — 単一クライアントコンポーネントに `useForm`(177)、75行の `handleSubmit`(298)、`handleAddition`/`handleDeleteKeyword`/`handleDeleteCountryFreeShipping`(373-406)、useState 9個、複数 field array（variants/colors/sizes/spec/questions）、サブカテゴリ取得（`getAllSubCategoriesFotCategory` at 251）、画像処理が同居。**注記**: recon のヒント `src/components/store/product-page/product-details.tsx` は**存在しない**（store 側は `product-info/`・`shipping/`・`reviews/` に分割済み）。1382行の実体はこの dashboard フォーム。
- **Impact**: リポジトリ最大の複雑度 UI ファイル（コンポーネント中央値 ~120行の一桁上）。フォームスキーマ配線・リモートデータ取得・約6個の配列エディタが1モジュールに混在し、seller 商品作成/編集フローの単体テストが困難で変更リスクが高い。
- **Effort**: L / **Risk**: MED（seller の中核フォーム。金額/在庫隣接フィールドに回帰が及ぶ。characterization テスト先行必須） / **Confidence**: HIGH
- **Fix sketch**: field array エディタ群を `useFieldArray` 駆動のプレゼンテーショナル子コンポーネントへ抽出、サブカテゴリ取得を `useSubcategories(categoryId)` フックへ、親にはフォーム組立 + submit のみ残す。

### [TECHDEBT-03] profile テーブル3種の重複したページネーション+フィルタロジックの抽出

- **Evidence**: ほぼ同一の state + fetch 骨格（`data/page/totalDataPages/filter/period/search` state、「filter 変更時に page リセット」effect、`[page, filter, search, period]` キーの取得 effect）が `src/components/store/profile/payments/payments-table.tsx:27-90`、`reviews/reviews-container.tsx:30-97`、`orders/orders-table.tsx:27-55` に3重複。差分はクエリ関数（`getUserPayments`/`getUserReviews`/`getUserOrders`）と行型のみ。
- **Impact**: 同一のページネーション/フィルタコントローラの3コピー。バグや挙動変更（debounce、高速フィルタ変更時の race ガード、エラー UX）は3箇所修正が必要で、既にドリフト済み（orders-table はリセットを別 effect に分離、他はインライン）。`getUserX(filter, period, search, page)` の同一シグネチャにもかかわらず共有抽象なし。
- **Effort**: M / **Risk**: LOW-MED（profile UI で挙動観測可能。既存コンテナテストで前後カバー） / **Confidence**: HIGH
- **Fix sketch**: `usePaginatedFilteredList(initialData, initialTotalPages, fetchFn)` フックが `{ data, page, totalPages, setPage, filter, setFilter, period, setPeriod, search, setSearch, loading }` を返し、3コンポーネントは薄いレンダ層に。

### [TECHDEBT-04] `order.ts` 内のインライン Zod スキーマを `src/lib/schemas.ts` へ移動

- **Evidence**: `src/queries/order.ts:294` がローカルに `AdminOrderFilterSchema = z.object({ … })` を定義。非テストソースで `src/lib/schemas.ts` 外の `z.object(...)` 定義はこれが唯一。同ファイルは 6行目で `TrackOrderSchema` を `@/lib/schemas` から正しく import 済み。
- **Impact**: 規約4（Zod スキーマは `src/lib/schemas.ts`）違反。admin 注文フィルタの入力契約だけが他の全スキーマと別居し、発見・再利用・並行テストが不能。
- **Effort**: S / **Risk**: LOW（純粋な移動。`limit` クランプのコメント含め同一形状を維持し検証挙動を不変に） / **Confidence**: HIGH
- **Fix sketch**: `AdminOrderFilterSchema`(294-) を型 export ごと `schemas.ts` へ切り出し、`order.ts` に import で戻す。

### [TECHDEBT-05] dead file `search copy.tsx` の削除

- **Evidence**: `src/components/store/layout/header/search/search copy.tsx` — 実体 `search/search.tsx` の `export default function Search()` 完全コピー。`src` 全体 grep で `search copy` の import なし。50行目に古いエラーハンドリングを保持し、ファイル名に空白を含む stale ファイル。
- **Impact**: 本物の検索コンポーネントを影で複製する未参照 dead ファイル。誤編集を誘発し、保守されている `search.tsx`（63/89 行に新しいログ形式）からドリフト。
- **Effort**: S / **Risk**: LOW（importer なし。削除前にリポジトリ全体 grep で再確認） / **Confidence**: HIGH
- **Fix sketch**: `search copy.tsx`（と単独参照の dead ヘルパーがあればそれも）を削除。

### [TECHDEBT-06] `src/` UI に残置されたデバッグ `console.log` の除去

- **Evidence**: `src/components/store/forms/apply-coupon.tsx:53` — クーポン適用 catch 内の `console.log(error)`（後続 `toast.error(error.toString())`）。`src/components/store/cart-page/container.tsx:39` — cart 同期 effect 内の `console.log('updatedCart--->', updatedCart)`。
- **Impact**: 規約3（`src/` で `console.log` 禁止）違反。cart 側は毎ロードでカート全内容をブラウザコンソールへダンプ、coupon 側はエラー経路のデバッグ残骸で構造化ロガーを使うべき箇所。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: cart のデバッグ行を削除。apply-coupon はタグ付き構造化形式 `console.error("[ApplyCoupon:handleSubmit] …", { error })`（または TECHDEBT-01 の `logError`）へ置換。

### [TECHDEBT-07] dashboard フォーム共通スキャフォールドの検討（低優先・spike 扱い）

- **Evidence**: dashboard の全9エンティティフォームが同一骨格を反復 — `useForm({ resolver: zodResolver(...) })`、受信データでの `form.reset` effect、`upsertX` → `toast.success/error` + `router.refresh/push` の `onSubmit`: `store-details.tsx:131`、`category-details.tsx:116`、`subCategory-details.tsx:127`、`offer-tag-details.tsx:106`、`shippingRate-details.tsx:129`、`store-default-shipping-details.tsx:127`、`coupon-details.tsx:88`、`admin-coupon-details.tsx:112`、`product-details.tsx:356`。
- **Impact**: submit/toast/refresh 配線とそのエラーハンドリングがフォームごとに再実装され、ログドリフト（TECHDEBT-01）が UI 層へ漏出する場所でもある。緊急ではない — フィールド差分は正当。薄い `useUpsertForm(schema, action, { onSuccess })` なら submit/エラー/toast 契約を一元化できる。
- **Effort**: M / **Risk**: MED（フォームの過剰抽象化は可読性を損なう。submit/error/toast スライスのみが対象、フィールドは対象外） / **Confidence**: LOW（パターンは実在するが集約価値は議論の余地 — 確定リファクタでなく investigate/spike を推奨）
- **Fix sketch**: 単純なフォーム2つ（category, offer-tag）で `useUpsertForm` をプロトタイプし、評価してから展開判断。

---

**Leverage 順（サブエージェント自己申告）**: TECHDEBT-05/06（自明なクリーンアップ・ほぼゼロリスク・最初に）→ TECHDEBT-04（小さな規約修正）→ TECHDEBT-01/03（最高レバレッジの構造改善。広い影響・LOW-MED リスク・既存ログ/コンテナテストで検証容易）→ TECHDEBT-02（高価値だが L effort/MED リスク — characterization テストでゲート）→ TECHDEBT-07（spike であり確定修正ではない）。
