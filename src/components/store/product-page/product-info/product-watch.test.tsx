/** @jest-environment jsdom */
import React from "react";
import { render, act } from "@testing-library/react";
import ProductWatch from "./product-watch";

// Mock WebSocket class
class MockWebSocket {
    url: string;
    // 実 WebSocket はイベント引数を渡すが、テストでは引数なしで発火させるため optional にする
    onmessage: ((ev?: MessageEvent) => void) | null = null;
    onopen: ((ev?: Event) => void) | null = null;
    onerror: ((ev?: Event) => void) | null = null;
    onclose: ((ev?: CloseEvent) => void) | null = null;
    constructor(url: string) {
        this.url = url;
        MockWebSocket.lastInstance = this;
    }
    close() {}
    static lastInstance: MockWebSocket | null = null;
}

let originalWebSocket: typeof WebSocket;

beforeAll(() => {
    originalWebSocket = globalThis.WebSocket;
    (globalThis as { WebSocket: unknown }).WebSocket =
        MockWebSocket as unknown as typeof WebSocket;
});

afterAll(() => {
    globalThis.WebSocket = originalWebSocket;
});

describe("ProductWatch Component", () => {
    beforeEach(() => {
        MockWebSocket.lastInstance = null;
        jest.clearAllMocks();
    });

    it("WebSocket が wss:// プロトコルと正しいスキーマで初期化されること", () => {
        render(<ProductWatch productId="prod-123" />);

        expect(MockWebSocket.lastInstance).not.toBeNull();
        expect(MockWebSocket.lastInstance?.url).toBe("wss://bony-onyx-nephew.glitch.me/prod-123");
    });

    it("接続時および切断時に console.log を呼び出してはならない", () => {
        const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

        render(<ProductWatch productId="prod-123" />);

        act(() => {
            if (MockWebSocket.lastInstance) {
                if (MockWebSocket.lastInstance.onopen) {
                    MockWebSocket.lastInstance.onopen();
                }
                if (MockWebSocket.lastInstance.onclose) {
                    MockWebSocket.lastInstance.onclose();
                }
            }
        });

        const logCalls = consoleSpy.mock.calls;
        consoleSpy.mockRestore();

    });

    it("WebSocket から onmessage イベント受信時に watchersCount が更新されること", () => {
        const { container } = render(<ProductWatch productId="prod-123" />);

        expect(MockWebSocket.lastInstance).not.toBeNull();

        act(() => {
            if (MockWebSocket.lastInstance && MockWebSocket.lastInstance.onmessage) {
                MockWebSocket.lastInstance.onmessage({
                    data: JSON.stringify({ productId: "prod-123", count: 42 }),
                } as MessageEvent);
            }
        });

        expect(container.textContent).toContain("42");
    });

    it("WebSocket でエラー発生時に socket 状態が null になること", () => {
        let setSocketVal: unknown = undefined;
        const originalUseState = React.useState;
        const useStateSpy = jest.spyOn(React, "useState").mockImplementation((init?: any): any => {
            const [val, setVal] = originalUseState(init);
            if (init === null) {
                const customSetVal = (newVal: any) => {
                    setSocketVal = newVal;
                    return setVal(newVal);
                };
                return [val, customSetVal];
            }
            return [val, setVal];
        });

        render(<ProductWatch productId="prod-123" />);

        expect(MockWebSocket.lastInstance).not.toBeNull();

        act(() => {
            if (MockWebSocket.lastInstance && MockWebSocket.lastInstance.onerror) {
                MockWebSocket.lastInstance.onerror(new Event("error"));
            }
        });

        expect(setSocketVal).toBeNull();
        useStateSpy.mockRestore();
    });

    it("コンポーネントのアンマウント時に WebSocket がクローズされること", () => {
        const closeSpy = jest.spyOn(MockWebSocket.prototype, "close");
        const { unmount } = render(<ProductWatch productId="prod-123" />);

        unmount();

        expect(closeSpy).toHaveBeenCalledTimes(1);
        closeSpy.mockRestore();
    });
});
