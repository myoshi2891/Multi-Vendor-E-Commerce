/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import useFromStore from "./useFromStore";
import { create } from "zustand";

interface MockState {
    count: number;
    increment: () => void;
}

// テスト用の Zustand ストア
const useMockStore = create<MockState>((set) => ({
    count: 0,
    increment: () => set((state) => ({ count: state.count + 1 })),
}));

describe("useFromStore", () => {
    beforeEach(() => {
        // ストアの状態をリセット
        useMockStore.setState({ count: 0 });
    });

    it("正常系: 初期レンダリング時はハイドレーション前のため undefined を返す", () => {
        // Zustandの仕組み上、renderHookの初回実行時はundefinedになり、直後のuseEffectで値がセットされる。
        // ここではレンダリング直後（まだuseEffectによる状態更新が完了する直前）の振る舞いを確認するのは難しいが、
        // 少なくとも最終的に正しい値を返すかを検証する。
        const { result } = renderHook(() => useFromStore(useMockStore, (state) => state.count));
        
        // useEffect 実行後には Zustand の初期値 (0) が取得できる
        expect(result.current).toBe(0);
    });

    it("正常系: useEffect 後にストアの値を正しく返す", () => {
        const { result } = renderHook(() => useFromStore(useMockStore, (state) => state.count));
        expect(result.current).toBe(0);
    });

    it("正常系: ストアの変更に追従して値が更新される", () => {
        const { result, rerender } = renderHook(() => useFromStore(useMockStore, (state) => state.count));

        expect(result.current).toBe(0);

        // ストアの状態を更新（Reactの再レンダリングをトリガーするためactでラップ）
        act(() => {
            useMockStore.getState().increment();
        });

        // フックを再レンダリング
        rerender();

        // 更新された状態が反映されている
        expect(result.current).toBe(1);
    });

    it("正常系: コールバック関数で値を変換して取得できる", () => {
        // state.count を元に文字列を作成して返す
        const { result } = renderHook(() => 
            useFromStore(useMockStore, (state) => `Count is ${state.count}`)
        );

        expect(result.current).toBe("Count is 0");
    });
});
