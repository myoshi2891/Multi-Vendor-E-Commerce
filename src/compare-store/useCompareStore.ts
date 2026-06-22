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
    /** 指定バリアントを比較リストから除去。 */
    removeFromCompare: (variantId: string) => void;
    /** 比較リストを空にする。 */
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
