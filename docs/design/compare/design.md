# Compare — 設計（design.md）

> 中核設計。実装者（Sonnet）が**該当行を特定して差分実装できる**粒度で記述する。
> 要件 ID は [requirements.md](./requirements.md)、手順は [tasks.md](./tasks.md)。

---

## 0. 設計の前提（実コードで確認済みの事実）

| #   | 事実                                                                                                                                    | 出典（行番号）                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0-1 | カートストアは `create(persist<State & Actions>(...))`（zustand + persist = localStorage）                                              | [`useCartStore.ts:30-31`](../../../src/cart-store/useCartStore.ts#L30-L31)                |
| 0-2 | ストアのテストはソースと同階層（`useCartStore.test.ts`）                                                                                | [`src/cart-store/useCartStore.test.ts`](../../../src/cart-store/useCartStore.test.ts)     |
| 0-3 | `getProductsByIds(ids, page?, pageSize?)` が `ProductType[]` を返す（バリアント ID 群 → 商品）                                          | [`product.ts:1511-1515`](../../../src/queries/product.ts#L1511-L1515)                     |
| 0-4 | `getProductsByIds` は **ids 空配列で throw**（"Ids are undefined"）。最大 1000 件で切り詰め                                             | [`product.ts:1518-1525`](../../../src/queries/product.ts#L1518-L1525)                     |
| 0-5 | `getProductsByIds` の select は variant（name/image/slug/images/sizes）+ product（name/rating/sales/numReviews）。**`Spec` は含まない** | [`product.ts:1539-1557`](../../../src/queries/product.ts#L1539-L1557)                     |
| 0-6 | 価格は `sizes[].price` に `toNumberSafe` 済みで返る                                                                                     | [`product.ts:1566-1569`](../../../src/queries/product.ts#L1566-L1569)                     |
| 0-7 | footer の「Compare」が `/compare` に配線済（ページ実装済み）                                                                              | [`footer/links.tsx:62-65`](../../../src/components/store/layout/footer/links.tsx#L62-L65) |

---

## 1. 共通設計

### 1.1 ディレクトリ構成（新規/変更）

```
src/compare-store/
  ├─ useCompareStore.ts          ← 新規（Zustand + persist・useCartStore と同型）
  └─ useCompareStore.test.ts     ← 新規（ユニット・同階層配置）

src/app/(store)/compare/page.tsx ← 新規（比較対象を取得しグリッド描画）
src/components/store/compare/
  ├─ compare-grid.tsx            ← 新規（client・グリッド表示 + 削除/全消去）
  └─ compare-grid.test.tsx       ← 新規（コンポーネント）
```

> **「Add to compare」ボタン**: MVP では商品カード/詳細への設置は最小に留める（または follow-up）。最小実装する場合は既存商品カード部品に `useCompareStore().addToCompare(variantId)` を呼ぶボタンを 1 つ足す（影響は加点的・別コミット）。

### 1.2 再利用元マトリクス

| 流用するもの           | 出典                                        | 用途                      |
| ---------------------- | ------------------------------------------- | ------------------------- |
| Zustand + persist 構造 | `useCartStore.ts:30-31`                     | `useCompareStore` の雛形  |
| ストアテストの書き方   | `useCartStore.test.ts`                      | `useCompareStore.test.ts` |
| 商品取得               | `getProductsByIds`（`product.ts:1511`）     | 比較対象の商品データ      |
| 価格表示 | `ProductPrice` | 割引とサイズ価格範囲を維持（配色のみ局所適用） |

### 1.3 認可方針

- 不要（公開・クライアント状態のみ）。`/compare` は middleware 保護対象外。

---

## 2. 機能詳細

### 2.1 Zustand ストア `useCompareStore.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 比較リストの上限。横並びグリッドの可読性のため 4 件。 */
const MAX_COMPARE = 4;

interface State {
    /** 比較対象の ProductVariant.id 配列（最大 MAX_COMPARE） */
    items: string[];
}

interface Actions {
    /** 追加（冪等・上限超過は無視）。 */
    addToCompare: (variantId: string) => void;
    removeFromCompare: (variantId: string) => void;
    clearCompare: () => void;
    /** 既に比較リストにあるか（ボタンのトグル表示用）。 */
    isComparing: (variantId: string) => boolean;
}

const INITIAL_STATE: State = { items: [] };

/**
 * 商品比較リスト（クライアント永続）。useCartStore と同型の zustand + persist。
 * バリアント ID のみを保持し、商品情報はページ側で getProductsByIds から取得する。
 */
export const useCompareStore = create(
    persist<State & Actions>(
        (set, get) => ({
            items: INITIAL_STATE.items,
            addToCompare: (variantId) => {
                if (!variantId) return; // 早期リターン
                const items = get().items;
                if (items.includes(variantId)) return; // 冪等（重複無視）
                if (items.length >= MAX_COMPARE) return; // 上限超過は拒否
                set({ items: [...items, variantId] });
            },
            removeFromCompare: (variantId) =>
                set({ items: get().items.filter((id) => id !== variantId) }),
            clearCompare: () => set({ items: [] }),
            isComparing: (variantId) => get().items.includes(variantId),
        }),
        { name: "compare-store" } // localStorage キー
    )
);
```

> **上限超過の UX**: 本設計は「無視（追加しない）」を採用。`addToCompare` が `boolean` を返してボタン側でトースト通知する拡張も可（任意・型を `=> boolean` に変更）。

### 2.2 ページ `compare/page.tsx`（Server Component）

- metadataは `Compare | Luxuries`。
- 深緑のヒーローにパンくず、`THE ART OF CHOOSING`、h1 `Compare products`、説明、`/browse`への継続導線を置く。下部のアイボリー面にCompareGridを配置する。
- `getProductsByIds` はServer Componentでimportし、`fetchProductsAction` propでClient Componentへ渡す。ページはlocalStorageを読まず、取得処理はクライアントのeffectから行う。既存のstore layoutの `force-dynamic` は維持する。

### 2.3 グリッド `compare-grid.tsx`（Client Component）

- prop: `fetchProductsAction: (ids: string[]) => Promise<{ products: ProductType[]; totalPages: number }>`。Client Componentからqueryを直接importしない。新規Server Actionは追加しない。
- `items` と再試行番号を依存に持つeffectで取得。空リストでは取得しない。キャンセルフラグで古い成功・失敗・finally結果の反映を防ぎ、全消去時はloadingも解除する。
- 選択件数 `n of 4 selected` とClear allを上部に表示。空状態はコレクションリンク、取得中は `role="status"` とスケルトン、失敗は `role="alert"` とTry again、取得ゼロは商品利用不可の案内とコレクションリンクを出す。失敗・取得ゼロでもストアの選択は消さない。
- 商品はarticle、名前はh3。画像、バリアント名、既存ProductPriceの価格／割引範囲、評価、販売数、View piece、個別削除を表示する。画像が無い場合は説明を表示し、商品URLはslugから補完する。
- ブランド装飾は `compare.module.css` でページ範囲に限定。既存の赤系Buttonは比較画面で使わず、native buttonを局所スタイルで装飾する。ProductPriceの表示ロジックは変更せず、価格文字の配色のみ比較画面内で上書きする。
- 1440pxでは最大4列、700px以下は260px幅の列を横並びで維持し比較領域のみスクロール。`role="region"`、名前 `Selected products`、tabIndex=0でキーボードから到達できる。ページ全体の横スクロールは発生させない。
- focus-visibleは濃いゴールドの輪郭。削除は44px、主導線は48px以上の操作領域。reduced-motionではスケルトンのアニメーションとCTAのtransitionを停止する。

## 3. テスト設計

> ストア: `src/compare-store/useCompareStore.test.ts`（同階層）。コンポーネント: `compare-grid.test.tsx`（RTL・`getProductsByIds` を mock）。

| テスト | 対象               | アサート（AAA）                                                | 対応 AC |
| ------ | ------------------ | -------------------------------------------------------------- | ------- |
| T-CMP1 | `useCompareStore`  | `addToCompare(id)` で `items` に入る                           | AC-CMP1 |
| T-CMP2 | `useCompareStore`  | 同一 id 再追加で長さ不変（冪等）                               | AC-CMP2 |
| T-CMP3 | `useCompareStore`  | 4 件保持時の 5 件目追加で長さ 4 のまま                         | AC-CMP3 |
| T-CMP4 | `useCompareStore`  | `removeFromCompare` / `clearCompare` が反映                    | AC-CMP4 |
| T-CMP5 | `compare-grid.tsx` | items 非空 → `getProductsByIds` を呼び商品が描画される（mock） | AC-CMP5 |
| T-CMP6 | `compare-grid.tsx` | items 空 → 空状態表示・`getProductsByIds` 未呼び出し（mock）   | AC-CMP6 |

> ストアのテストは各テスト前に `useCompareStore.setState({ items: [] })` でリセット（`useCartStore.test.ts` のリセット流儀に倣う）。

---

## 判断1. なぜ Zustand + persist か

- 既存 `useCartStore` と同型でプロジェクトの状態管理流儀に一致（[tech.md: 状態管理 = Zustand](../../../.claude/steering/tech.md)）。
- localStorage 永続でリロードしても比較リストが残る。サーバー保存は不要（低優先度機能）。

## 判断2. なぜバリアント ID を保持するか

- 価格・在庫・画像はバリアント単位（[structure.md](../../../.claude/steering/structure.md)）。カートと同じ粒度にすることで `getProductsByIds`（バリアント ID 入力）にそのまま渡せる。

## 判断3. なぜ新規クエリを作らないか

- `getProductsByIds`（事実 0-3）が比較に必要な商品情報を返す。新規 server action は不要（global CLAUDE.md「不要なファイル編集を回避」）。
- ただし `Spec` は含まれない（事実 0-5）→ スペック比較は任意拡張（判断4）。

## 判断4. スペック比較の扱い（任意拡張）

- 詳細スペック行比較（重量/素材等）が必要なら、`getProductsByIds` の variant select に `specs: { select: { name: true, value: true } }` を追加するか、専用 include 版を作る。
- MVP は基本フィールド（名前/画像/価格/評価）で比較し、スペック行は follow-up とする（スコープ外・requirements §4）。

---

## 影響箇所マトリクス

| パス                                            | 変更種別           | 理由                                     | リスク                   |
| ----------------------------------------------- | ------------------ | ---------------------------------------- | ------------------------ |
| `src/compare-store/useCompareStore.ts`          | 新規               | 比較ストア                               | 低                       |
| `src/compare-store/useCompareStore.test.ts`     | 新規               | ストアテスト                             | 低                       |
| `src/app/(store)/compare/page.tsx`              | 新規               | ページ本体                               | 低                       |
| `src/components/store/compare/compare-grid.tsx` | 新規               | グリッド                                 | 低                       |
| 既存商品カード部品                              | 変更（任意・最小） | 「Add to compare」ボタン（follow-up 可） | 低（加点的・別コミット） |

---

## リスク分析

| リスク                                        | 区分         | 緩和策                                                                                         |
| --------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `getProductsByIds` の空配列 throw             | バグ         | `items.length === 0` で呼ばない（AC-CMP6）                                                     |
| localStorage に残った無効 ID（削除済み商品）  | データ整合   | `getProductsByIds` は存在する variant のみ返す。差分が出ても描画は欠落のみ（クラッシュしない） |
| SSR でストアを読もうとして hydration mismatch | レンダリング | ストアは client 部品（`CompareGrid`）でのみ読む。page は Server Component で localStorage を読まず、`getProductsByIds` を `fetchProductsAction` prop として注入するだけ。商品取得は `CompareGrid` の effect 内でクライアント側から行う |
| スペック未対応で比較価値が薄い                | UX           | 判断4 の任意拡張で対応。MVP は基本比較                                                         |

---

## Verification（実装後の検証手順）

1. `bun run lint` / `bunx tsc --noEmit` / `bun run test`（T-CMP1〜T-CMP6）/ `bun run build`。
2. `bun run dev` → 商品（バリアント）を比較に追加（最小ボタン or devtools で `useCompareStore.getState().addToCompare(id)`）→ `/compare` で横並び表示を確認。
3. リロードしても比較リストが残ること（localStorage 永続）。
4. 全消去・個別削除・上限 4 件・空状態を確認。
5. footer「Compare」から到達できること。

## デザイン移行の検証（2026-09-30）

[移行計画](../../../plans/layout-design/compare-design-system-plan.md)に基づき、既存グリッドテストへ5件追加。先行実行でUI未対応4件失敗、既存回帰8件成功。実装後グリッド12件・ストア11件成功。`tests/e2e/compare-design.spec.ts` の6件は1440px／390px／700pxで配色・focus・ローカルスクロール・axe・失敗／再試行・取得ゼロ・削除を検証する。商品取得応答はフィクスチャ化し、DBを書き換えない。記録の正本は[移行進捗](../design-system/PROGRESS.md)。スペック行比較は引き続き対象外。

## P2残存表示統一（2026-10-09）

比較rootにstore限定purchase themeを合成し、hero/card/price/罫線/意味色/focusを役割別tokensへ統一。暗いheroのfocusには装飾gold、明るい面には濃いfocusを使う。ProductPriceの計算・4件制限・削除・全消去・保存方式・Action Propsは不変。

[保存計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。


## 優先8画面受け入れ（2026-10-11）

CompareGridの選択見出しをrefとtabIndex=-1でprogrammatic focus先にする。削除/clear handlerで同期的に移動し、通常Tab順には追加しない。見出しのfocus outlineはpurchase-focus、件数はaria-live=polite。fetch/action/store契約は変更しない。
