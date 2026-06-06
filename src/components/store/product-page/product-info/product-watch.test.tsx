/** @jest-environment jsdom */
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

(globalThis as { WebSocket: unknown }).WebSocket =
    MockWebSocket as unknown as typeof WebSocket;

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

        expect(logCalls.length).toBe(0);
    });
});
