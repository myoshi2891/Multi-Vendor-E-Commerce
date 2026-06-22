// localStorage モック（useCartStore.test.ts と同流儀）
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

import { useCompareStore } from "./useCompareStore";

beforeEach(() => {
    // 永続化ストレージとインメモリ状態の両方をリセット
    localStorageMock.clear();
    useCompareStore.setState({ items: [] });
    jest.clearAllMocks();
});

// ==================================================
// addToCompare
// ==================================================
describe("addToCompare", () => {
    // T-CMP1 / AC-CMP1
    it("バリアント ID を比較リストに追加する", () => {
        useCompareStore.getState().addToCompare("variant-1");

        expect(useCompareStore.getState().items).toEqual(["variant-1"]);
    });

    it("空文字列は追加しない（早期リターン）", () => {
        useCompareStore.getState().addToCompare("");

        expect(useCompareStore.getState().items).toHaveLength(0);
    });

    // T-CMP2 / AC-CMP2
    it("同一 ID を再追加してもリスト長は増えない（冪等）", () => {
        useCompareStore.getState().addToCompare("variant-1");
        useCompareStore.getState().addToCompare("variant-1");

        expect(useCompareStore.getState().items).toEqual(["variant-1"]);
    });

    // T-CMP3 / AC-CMP3
    it("上限 4 件に達した状態で 5 件目を追加すると拒否される", () => {
        const store = useCompareStore.getState();
        store.addToCompare("v1");
        store.addToCompare("v2");
        store.addToCompare("v3");
        store.addToCompare("v4");

        store.addToCompare("v5");

        const items = useCompareStore.getState().items;
        expect(items).toHaveLength(4);
        expect(items).not.toContain("v5");
    });
});

// ==================================================
// removeFromCompare / clearCompare
// ==================================================
describe("removeFromCompare / clearCompare", () => {
    // T-CMP4 / AC-CMP4
    it("removeFromCompare で指定 ID が除かれる", () => {
        const store = useCompareStore.getState();
        store.addToCompare("v1");
        store.addToCompare("v2");

        store.removeFromCompare("v1");

        expect(useCompareStore.getState().items).toEqual(["v2"]);
    });

    it("clearCompare で全消去される", () => {
        const store = useCompareStore.getState();
        store.addToCompare("v1");
        store.addToCompare("v2");

        store.clearCompare();

        expect(useCompareStore.getState().items).toEqual([]);
    });
});

// ==================================================
// 永続化レイヤー契約（persist: localStorage 書き込み / 再ハイドレート）
// ==================================================
describe("persistence", () => {
    /** 直近の setItem 呼び出しから永続化された items 配列を取り出す。 */
    const persistedItems = (): unknown => {
        const calls = localStorageMock.setItem.mock.calls;
        const last = calls[calls.length - 1];
        expect(last[0]).toBe("compare-store"); // persist の name キー
        return JSON.parse(last[1]).state.items;
    };

    it("addToCompare で compare-store キーに items が永続化される", () => {
        useCompareStore.getState().addToCompare("v1");

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            "compare-store",
            expect.any(String)
        );
        expect(persistedItems()).toContain("v1");
    });

    it("removeFromCompare 後も最新 items が永続化される", () => {
        const store = useCompareStore.getState();
        store.addToCompare("v1");
        store.addToCompare("v2");

        store.removeFromCompare("v1");

        expect(persistedItems()).toEqual(["v2"]);
    });

    it("既存の永続データから items を再ハイドレートする", async () => {
        // 事前に永続済みデータを localStorage に注入してからリハイドレート
        localStorageMock.setItem(
            "compare-store",
            JSON.stringify({ state: { items: ["v1", "v2"] }, version: 0 })
        );

        await useCompareStore.persist.rehydrate();

        expect(useCompareStore.getState().items).toEqual(["v1", "v2"]);
    });
});

// ==================================================
// isComparing（ボタンのトグル判定用）
// ==================================================
describe("isComparing", () => {
    it("リストに含まれる ID は true を返す", () => {
        useCompareStore.getState().addToCompare("v1");

        expect(useCompareStore.getState().isComparing("v1")).toBe(true);
    });

    it("リストに無い ID は false を返す", () => {
        expect(useCompareStore.getState().isComparing("v1")).toBe(false);
    });
});
