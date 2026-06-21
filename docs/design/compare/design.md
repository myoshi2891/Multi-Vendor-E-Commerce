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
| 0-7 | footer の「Compare」が `/compare` に配線済（ページが無い）                                                                              | [`footer/links.tsx:62-65`](../../../src/components/store/layout/footer/links.tsx#L62-L65) |

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
| 商品カード/価格表示    | 既存 home/browse の商品カード部品（要調査） | グリッドの各セル描画      |

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

### 2.2 ページ `compare/page.tsx`

**方針**: クライアント側ストアの id を読むため、ページは client wrapper を描画する（id は localStorage にあり SSR 不可）。データ取得は client から server action `getProductsByIds` を呼ぶ。

```tsx
// src/app/(store)/compare/page.tsx
import type { Metadata } from "next";
import CompareGrid from "@/components/store/compare/compare-grid";

export const metadata: Metadata = { title: "Compare | Marketplace" };

/**
 * 商品比較ページ。比較リスト（localStorage）はクライアントにあるため
 * CompareGrid（client）が useCompareStore を読み getProductsByIds で取得する。
 * src/queries を render 時に直接呼ばないため force-dynamic は不要。
 */
export default function ComparePage() {
    return (
        <main className="mx-auto max-w-6xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Compare products</h1>
            <CompareGrid />
        </main>
    );
}
```

### 2.3 グリッド `compare-grid.tsx`（client）

```tsx
"use client";
import { useEffect, useState } from "react";
import { useCompareStore } from "@/compare-store/useCompareStore";
import { getProductsByIds } from "@/queries/product";
import type { ProductType } from "@/lib/types";

export default function CompareGrid() {
    const items = useCompareStore((s) => s.items);
    const removeFromCompare = useCompareStore((s) => s.removeFromCompare);
    const clearCompare = useCompareStore((s) => s.clearCompare);
    const [products, setProducts] = useState<ProductType[]>([]);
    const [loading, setLoading] = useState(false);

    // tech.md「useEffect キャンセルフラグ」パターンで古いレスポンスの上書きを防ぐ。
    useEffect(() => {
        let cancelled = false;
        if (items.length === 0) {
            setProducts([]); // 空リストは getProductsByIds を呼ばない（空配列 throw 回避・事実 0-4）
            return;
        }
        setLoading(true);
        (async () => {
            try {
                const { products } = await getProductsByIds(items);
                if (!cancelled) setProducts(products);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[Compare:fetch] failed",
                        error.message,
                        error.stack
                    );
                }
                if (!cancelled) setProducts([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [items]);

    if (items.length === 0) {
        return (
            <p>
                比較する商品がありません。商品ページから比較に追加してください。
            </p>
        );
    }

    // ↓ products を横並びカラムで描画（名前/画像/最安価格/評価 + 各列に削除ボタン）。
    //   上部に「全消去」ボタン（clearCompare）。loading 中はスケルトン。
    return /* グリッド（既存商品カード部品の流用を検討） */ null;
}
```

> **空配列の扱い（重要）**: `getProductsByIds` は ids 空で throw する（事実 0-4）。`items.length === 0` のとき**呼ばない**で空状態を出す（NFR-CMP4 / AC-CMP6）。

---

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
| SSR でストアを読もうとして hydration mismatch | レンダリング | ストアは client 部品（`CompareGrid`）でのみ読む。page は wrapper のみ                          |
| スペック未対応で比較価値が薄い                | UX           | 判断4 の任意拡張で対応。MVP は基本比較                                                         |

---

## Verification（実装後の検証手順）

1. `bun run lint` / `bunx tsc --noEmit` / `bun run test`（T-CMP1〜T-CMP6）/ `bun run build`。
2. `bun run dev` → 商品（バリアント）を比較に追加（最小ボタン or devtools で `useCompareStore.getState().addToCompare(id)`）→ `/compare` で横並び表示を確認。
3. リロードしても比較リストが残ること（localStorage 永続）。
4. 全消去・個別削除・上限 4 件・空状態を確認。
5. footer「Compare」から到達できること。
