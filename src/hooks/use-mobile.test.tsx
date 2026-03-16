/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "./use-mobile";

describe("useIsMobile", () => {
    // 状態をコントロールするための変数
    let mqlListeners: { [key: string]: EventListener[] } = {};
    let isMobileMatch = false;

    beforeEach(() => {
        mqlListeners = {};
        isMobileMatch = false;

        // window.matchMedia のモック
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: jest.fn().mockImplementation((query) => {
                // テストのシナリオに応じて matches の状態を切り替えられるようにする
                return {
                    matches: isMobileMatch,
                    media: query,
                    onchange: null,
                    addEventListener: jest.fn((event: string, callback: EventListener) => {
                        if (!mqlListeners[event]) {
                            mqlListeners[event] = [];
                        }
                        mqlListeners[event].push(callback);
                    }),
                    removeEventListener: jest.fn((event: string, callback: EventListener) => {
                        if (mqlListeners[event]) {
                            mqlListeners[event] = mqlListeners[event].filter((cb) => cb !== callback);
                        }
                    }),
                    dispatchEvent: jest.fn(),
                };
            }),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("正常系: 初期状態（innerWidth < 768 の場合）で true を返す", () => {
        // window.innerWidth をモバイルサイズにモック
        Object.defineProperty(window, "innerWidth", { writable: true, value: 500 });
        isMobileMatch = true;

        const { result } = renderHook(() => useIsMobile());

        // 初回レンダリング後は true になる
        expect(result.current).toBe(true);
    });

    it("正常系: 初期状態（innerWidth >= 768 の場合）で false を返す", () => {
        // window.innerWidth をデスクトップサイズにモック
        Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });
        isMobileMatch = false;

        const { result } = renderHook(() => useIsMobile());

        expect(result.current).toBe(false);
    });

    it("境界値: innerWidth が丁度 768 の場合 false を返す", () => {
        Object.defineProperty(window, "innerWidth", { writable: true, value: 768 });
        isMobileMatch = false;

        const { result } = renderHook(() => useIsMobile());

        expect(result.current).toBe(false);
    });

    it("境界値: innerWidth が 767 の場合 true を返す", () => {
        Object.defineProperty(window, "innerWidth", { writable: true, value: 767 });
        isMobileMatch = true;

        const { result } = renderHook(() => useIsMobile());

        expect(result.current).toBe(true);
    });

    it("正常系: matchMedia の change イベントで値が更新される", () => {
        Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });
        isMobileMatch = false;

        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(false);

        // リサイズをシミュレート（モバイルサイズに変更）
        act(() => {
            Object.defineProperty(window, "innerWidth", { writable: true, value: 500 });
            // matchMediaのイベントリスナーを発火させる
            if (mqlListeners["change"]) {
                mqlListeners["change"].forEach((listener) => {
                    // イベントオブジェクトのダミーを渡す
                    listener({ matches: true } as unknown as Event);
                });
            }
        });

        // 状態が true に更新されたか検証
        expect(result.current).toBe(true);
    });

    it("正常系: アンマウント時にイベントリスナーが除去される", () => {
        Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });
        isMobileMatch = false;

        const { unmount } = renderHook(() => useIsMobile());
        
        // 追加されていることを確認
        expect(mqlListeners["change"].length).toBe(1);

        // アンマウント実行
        unmount();

        // 削除されていることを確認
        expect(mqlListeners["change"].length).toBe(0);
    });

    it("エッジケース: matchMedia 未対応環境でクラッシュしない", () => {
        // matchMedia が存在しない環境をシミュレート
        Object.defineProperty(window, "matchMedia", { writable: true, value: undefined });
        
        // window.innerWidth を一応定義
        Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });

        // 例外が発生しないことを確認
        expect(() => {
            renderHook(() => useIsMobile());
        }).not.toThrow();
    });
});
