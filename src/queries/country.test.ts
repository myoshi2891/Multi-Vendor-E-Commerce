import { getAllCountries } from "./country";
import { db } from "@/lib/db";
import { createMockCountry } from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@/lib/db", () => ({
    db: {
        country: {
            findMany: jest.fn(),
        },
    },
}));

// require("@/lib/db") は暗黙 any を招くため使わない。
// 型付き import した db を jest.MockedFunction で絞り込む。
const mockFindMany = db.country.findMany as jest.MockedFunction<
    typeof db.country.findMany
>;

let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});

// ==================================================
// getAllCountries
// ==================================================
describe("getAllCountries", () => {
    describe("正常系", () => {
        it("国一覧を name 昇順で取得して返す", async () => {
            // Arrange
            const country = createMockCountry();
            mockFindMany.mockResolvedValue([country]);

            // Act
            const result = await getAllCountries();

            // Assert
            expect(result).toEqual([country]);
            // 昇順ソートは呼び出し契約として固定する
            expect(mockFindMany).toHaveBeenCalledWith({
                orderBy: { name: "asc" },
            });
        });
    });

    describe("catch 分岐網羅（Error / unknown 両系統）", () => {
        // 本体の catch は `instanceof Error` の真偽で console.error の引数形状を
        // 変える。両系統を通し、内部エラー詳細が呼び出し側へ漏れないことを固定する。
        it("DB エラー（Error）の場合、汎用メッセージをスローし message と stack をログする", async () => {
            // Arrange
            mockFindMany.mockRejectedValue(new Error("db down"));

            // Act & Assert
            await expect(getAllCountries()).rejects.toThrow(
                "Failed to retrieve countries."
            );
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Error retrieving countries:",
                "db down",
                expect.any(String)
            );
        });

        it("DB エラー（非 Error）の場合、生の値をそのままログする", async () => {
            // Arrange
            mockFindMany.mockRejectedValue("boom");

            // Act & Assert
            await expect(getAllCountries()).rejects.toThrow(
                "Failed to retrieve countries."
            );
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Error retrieving countries:",
                "boom"
            );
        });
    });

    describe("エラー詳細の非漏洩", () => {
        it("スローされるメッセージが汎用文言と完全一致し、内部詳細を含まない", async () => {
            // Arrange
            mockFindMany.mockRejectedValue(new Error("db down"));

            // Act & Assert
            // toThrow(string) は部分一致のため、完全一致の検証には使わない。
            await expect(getAllCountries()).rejects.toThrow(
                /^Failed to retrieve countries\.$/
            );
        });
    });
});
