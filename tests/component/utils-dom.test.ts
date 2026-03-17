/** @jest-environment jsdom */

import { updateProductHistory, downloadBlobAsFile, printPDF } from "@/lib/utils";

describe("DOM Utilities", () => {
    describe("updateProductHistory", () => {
        beforeEach(() => {
            localStorage.clear();
        });

        it("[P1] localStorage に新しい variantId が追加される", () => {
            updateProductHistory("v1");
            const history = JSON.parse(localStorage.getItem("productHistory") || "[]");
            expect(history).toEqual(["v1"]);
        });

        it("[P1] 既存 variantId は先頭に移動 (重複除去)", () => {
            localStorage.setItem("productHistory", JSON.stringify(["v2", "v1", "v3"]));
            updateProductHistory("v1");
            const history = JSON.parse(localStorage.getItem("productHistory") || "[]");
            expect(history).toEqual(["v1", "v2", "v3"]);
        });

        it("[P1] MAX_PRODUCTS (100) 超過で最古エントリ削除", () => {
            const initialHistory = Array.from({ length: 100 }, (_, i) => `v${i}`);
            localStorage.setItem("productHistory", JSON.stringify(initialHistory));
            
            updateProductHistory("v-new");
            const history = JSON.parse(localStorage.getItem("productHistory") || "[]");
            
            expect(history.length).toBe(100);
            expect(history[0]).toBe("v-new");
            // The oldest one (v99) should be removed
            expect(history).not.toContain("v99");
        });

        it("[P2] localStorage が空なら新規配列を作成", () => {
            expect(localStorage.getItem("productHistory")).toBeNull();
            updateProductHistory("v1");
            expect(JSON.parse(localStorage.getItem("productHistory")!)).toEqual(["v1"]);
        });

        it("[P1] localStorage の値が不正 JSON なら空配列から開始", () => {
            localStorage.setItem("productHistory", "invalid-json");
            updateProductHistory("v1");
            expect(JSON.parse(localStorage.getItem("productHistory")!)).toEqual(["v1"]);
        });

        it("[P2] 同じ variantId を連続追加しても重複しない", () => {
            updateProductHistory("v1");
            updateProductHistory("v1");
            const history = JSON.parse(localStorage.getItem("productHistory") || "[]");
            expect(history).toEqual(["v1"]);
        });

        it("[P2] 100 件丁度で削除されない", () => {
            const initialHistory = Array.from({ length: 99 }, (_, i) => `v${i}`);
            localStorage.setItem("productHistory", JSON.stringify(initialHistory));
            
            updateProductHistory("v-new");
            const history = JSON.parse(localStorage.getItem("productHistory") || "[]");
            
            expect(history.length).toBe(100);
            expect(history[0]).toBe("v-new");
            expect(history).toContain("v98"); // oldest
        });
    });

    describe("downloadBlobAsFile", () => {
        let originalCreateObjectURL: typeof URL.createObjectURL;
        let originalRevokeObjectURL: typeof URL.revokeObjectURL;

        beforeEach(() => {
            originalCreateObjectURL = URL.createObjectURL;
            originalRevokeObjectURL = URL.revokeObjectURL;
            
            URL.createObjectURL = jest.fn(() => "blob:test-url");
            URL.revokeObjectURL = jest.fn();
            
            // HTMLAnchorElement のモック
            jest.spyOn(document, "createElement").mockImplementation((tagName: string) => {
                if (tagName === "a") {
                    return {
                        href: "",
                        download: "",
                        click: jest.fn(),
                    } as unknown as HTMLElement;
                }
                return document.createElement.bind(document)(tagName);
            });
        });

        afterEach(() => {
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
            jest.restoreAllMocks();
        });

        it("[P2] Blob からファイルがダウンロードされる", () => {
            const mockBlob = new Blob(["test"], { type: "text/plain" });
            const filename = "test.txt";
            
            // Document.createElement is mocked to return our object, so we capture the instance returned
            let mockAnchor: any;
            (document.createElement as jest.Mock).mockImplementation((tagName: string) => {
                if (tagName === "a") {
                    mockAnchor = {
                        href: "",
                        download: "",
                        click: jest.fn(),
                    };
                    return mockAnchor;
                }
                return document.createElement.bind(document)(tagName);
            });

            downloadBlobAsFile(mockBlob, filename);

            expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
            expect(mockAnchor.href).toBe("blob:test-url");
            expect(mockAnchor.download).toBe(filename);
            expect(mockAnchor.click).toHaveBeenCalled();
            expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
        });
    });

    describe("printPDF", () => {
        let originalCreateObjectURL: typeof URL.createObjectURL;
        let originalRevokeObjectURL: typeof URL.revokeObjectURL;

        beforeEach(() => {
            originalCreateObjectURL = URL.createObjectURL;
            originalRevokeObjectURL = URL.revokeObjectURL;
            
            URL.createObjectURL = jest.fn(() => "blob:test-pdf-url");
            URL.revokeObjectURL = jest.fn();
            jest.useFakeTimers();
        });

        afterEach(() => {
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
            document.body.innerHTML = "";
        });

        it("[P2] PDF の印刷が実行され、クリーンアップされる", () => {
            const mockBlob = new Blob(["pdf-content"], { type: "application/pdf" });
            
            // Mock appendChild so jsdom doesn't complain about our fake node
            const appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation(() => { return undefined as any; });
            
            const mockContentWindow = {
                focus: jest.fn(),
                print: jest.fn(),
            };
            
            const mockIframe: any = {
                style: {
                    position: "",
                    width: "",
                    height: "",
                    visibility: "",
                },
                src: "",
                onload: null,
                contentWindow: mockContentWindow,
                remove: jest.fn(),
            };

            jest.spyOn(document, "createElement").mockImplementation((tagName: string) => {
                if (tagName === "iframe") {
                    return mockIframe;
                }
                return document.createElement.bind(document)(tagName);
            });

            printPDF(mockBlob);

            expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
            
            // iframe が追加されたか
            expect(appendChildSpy).toHaveBeenCalledWith(mockIframe);
            expect(mockIframe.style.visibility).toBe("hidden");
            expect(mockIframe.src).toBe("blob:test-pdf-url");

            // onload を手動でトリガー
            expect(mockIframe.onload).toBeInstanceOf(Function);
            mockIframe.onload();

            // print と focus が呼ばれたか
            expect(mockContentWindow.focus).toHaveBeenCalled();
            expect(mockContentWindow.print).toHaveBeenCalled();

            // タイマーを進めてクリーンアップを確認
            jest.advanceTimersByTime(2000);

            expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-pdf-url");
            expect(mockIframe.remove).toHaveBeenCalled();
            
            jest.restoreAllMocks();
        });

        it("[P2] contentWindow が null の場合に print が呼ばれない", () => {
            const mockBlob = new Blob(["pdf-content"], { type: "application/pdf" });
            
            jest.spyOn(document.body, "appendChild").mockImplementation(() => { return undefined as any; });
            
            const mockIframe: any = {
                style: {},
                src: "",
                onload: null,
                contentWindow: null,
                remove: jest.fn(),
            };

            jest.spyOn(document, "createElement").mockImplementation((tagName: string) => {
                if (tagName === "iframe") {
                    return mockIframe;
                }
                return document.createElement.bind(document)(tagName);
            });

            printPDF(mockBlob);

            expect(mockIframe.onload).toBeInstanceOf(Function);
            
            // エラーを投げないことを確認
            expect(() => mockIframe.onload()).not.toThrow();
            
            jest.restoreAllMocks();
        });
    });
});