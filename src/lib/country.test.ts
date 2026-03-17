import { getUserCountry } from "./country";
import { AssertionHelpers } from "@/config/test-helpers";

// Fetch API のモック化
const mockFetch = jest.fn();
global.fetch = mockFetch;

const DEFAULT_COUNTRY = {
    name: "United States",
    code: "US",
    city: "",
    region: "",
};

describe("getUserCountry", () => {
    let consoleErrorSpy: jest.SpyInstance;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        // エラーログを抑制
        consoleErrorSpy = AssertionHelpers.mockConsoleError();
        // タイマーのモック化
        jest.useFakeTimers();
        // 環境変数のバックアップと設定
        originalEnv = { ...process.env };
        process.env.IPINFO_TOKEN = "test-token";
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        process.env = originalEnv;
    });

    describe("正常系", () => {
        it("[P1] ipinfo.io 正常レスポンスで国名・コード・都市・地域を返す", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    country: "US",
                    city: "New York",
                    region: "NY",
                }),
            });

            const result = await getUserCountry();

            expect(mockFetch).toHaveBeenCalledWith(
                "https://ipinfo.io/?token=test-token",
                expect.objectContaining({
                    signal: expect.any(AbortSignal),
                })
            );
            expect(result).toEqual({
                name: "United States",
                code: "US",
                city: "New York",
                region: "NY",
            });
        });

        it("[P1] 国コード 'JP' で countries.json から 'Japan' を逆引きする", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    country: "JP",
                    city: "Tokyo",
                    region: "Tokyo",
                }),
            });

            const result = await getUserCountry();

            expect(result).toEqual({
                name: "Japan",
                code: "JP",
                city: "Tokyo",
                region: "Tokyo",
            });
        });

        it("[P1] countries.json にない国コードはコードをそのまま name に使用する", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    country: "XX",
                    city: "Unknown City",
                    region: "Unknown Region",
                }),
            });

            const result = await getUserCountry();

            expect(result).toEqual({
                name: "XX",
                code: "XX",
                city: "Unknown City",
                region: "Unknown Region",
            });
        });

        it("[P2] city/region が null の場合、空文字にフォールバック", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    country: "JP",
                    city: null,
                    region: null,
                }),
            });

            const result = await getUserCountry();

            expect(result).toEqual({
                name: "Japan",
                code: "JP",
                city: "",
                region: "",
            });
        });
    });

    describe("異常系", () => {
        it("[P0] fetch が非200レスポンスの場合、デフォルト国 (US) を返す", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
            });

            const result = await getUserCountry();

            expect(result).toEqual(DEFAULT_COUNTRY);
        });

        it("[P0] fetch がネットワークエラーの場合、デフォルト国を返す", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Network Error"));

            const result = await getUserCountry();

            expect(result).toEqual(DEFAULT_COUNTRY);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it("[P1] country フィールドなしの場合、US の name/code + レスポンスの city/region", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    city: "Toronto",
                    region: "Ontario",
                }),
            });

            const result = await getUserCountry();

            expect(result).toEqual({
                name: "United States",
                code: "US",
                city: "Toronto",
                region: "Ontario",
            });
        });

        it("[P0] AbortController タイムアウト (2秒超過) でデフォルト国を返す", async () => {
            mockFetch.mockImplementationOnce((url: string, options: any) => {
                return new Promise((resolve, reject) => {
                    if (options && options.signal) {
                        options.signal.addEventListener("abort", () => {
                            reject(new Error("AbortError"));
                        });
                    }
                });
            });

            const promise = getUserCountry();

            // タイムアウトをトリガーさせる
            jest.advanceTimersByTime(2000);

            const result = await promise;

            expect(result).toEqual(DEFAULT_COUNTRY);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to get user's country",
                expect.any(Error)
            );
        });

        it("[P1] JSON パースエラーの場合、デフォルト国を返す", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => {
                    throw new Error("Invalid JSON");
                },
            });

            const result = await getUserCountry();

            expect(result).toEqual(DEFAULT_COUNTRY);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe("エッジケース", () => {
        it("[P2] IPINFO_TOKEN が undefined でも fetch は呼ばれる", async () => {
            delete process.env.IPINFO_TOKEN;

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    country: "JP",
                }),
            });

            await getUserCountry();

            expect(mockFetch).toHaveBeenCalledWith(
                "https://ipinfo.io/?token=undefined",
                expect.any(Object)
            );
        });

        it("[P2] country が空文字の場合の挙動", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    country: "",
                    city: "Test City",
                    region: "Test Region",
                }),
            });

            const result = await getUserCountry();

            expect(result).toEqual({
                name: "United States",
                code: "US",
                city: "Test City",
                region: "Test Region",
            });
        });
    });

    describe("副作用", () => {
        it("[P2] エラー時に console.error が呼ばれる", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Test Error"));

            await getUserCountry();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to get user's country",
                expect.any(Error)
            );
        });

        it("[P2] clearTimeout が finally で必ず呼ばれる", async () => {
            const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ country: "US" }),
            });

            await getUserCountry();

            // try ブロック内の成功ルートで clearTimeout が呼ばれ、
            // finally ブロックでも呼ばれるため合計2回呼ばれる可能性がある。
            // 実装では try-finally なので必ず呼ばれることを確認
            expect(clearTimeoutSpy).toHaveBeenCalled();
            clearTimeoutSpy.mockRestore();
        });

        it("[P2] タイムアウト時に AbortController.abort() が発火する", async () => {
            const abortSpy = jest.spyOn(AbortController.prototype, "abort");

            mockFetch.mockImplementationOnce((url: string, options: any) => {
                return new Promise((resolve, reject) => {
                    if (options && options.signal) {
                        options.signal.addEventListener("abort", () => {
                            reject(new Error("AbortError"));
                        });
                    }
                });
            });

            const promise = getUserCountry();

            jest.advanceTimersByTime(2000);

            await promise;

            expect(abortSpy).toHaveBeenCalled();
            abortSpy.mockRestore();
        });
    });
});
