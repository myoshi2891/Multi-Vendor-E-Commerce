import { db } from "@/lib/db";
import { dispatchPendingDeliveries } from "@/lib/notifications/dispatch";
import { GET } from "./route";

jest.mock("@/lib/db", () => ({
    db: { notification: { deleteMany: jest.fn() } },
}));
jest.mock("@/lib/notifications/dispatch", () => ({
    dispatchPendingDeliveries: jest.fn(),
}));

const mockDispatch = dispatchPendingDeliveries as jest.Mock;
const mockDeleteMany = (
    db as unknown as { notification: { deleteMany: jest.Mock } }
).notification.deleteMany;

const url = "http://localhost:3000/api/cron/notifications";
const request = (authorization?: string) =>
    new Request(url, {
        headers: authorization ? { authorization } : {},
    });

describe("GET /api/cron/notifications", () => {
    const original = process.env.CRON_SECRET;
    let errSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CRON_SECRET = "s3cret-value";
        mockDispatch.mockResolvedValue({
            sent: 2,
            retried: 1,
            failed: 0,
            skipped: 0,
        });
        mockDeleteMany.mockResolvedValue({ count: 5 });
        errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        errSpy.mockRestore();
        if (original === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = original;
    });

    it("CRON_SECRET が未設定なら 503 を返し、何もしない", async () => {
        // Arrange
        delete process.env.CRON_SECRET;

        // Act
        const response = await GET(request("Bearer s3cret-value"));

        // Assert
        expect(response.status).toBe(503);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("空白だけの CRON_SECRET も未設定として扱う", async () => {
        // Arrange
        process.env.CRON_SECRET = "   ";

        // Act
        const response = await GET(request("Bearer    "));

        // Assert
        expect(response.status).toBe(503);
    });

    it.each([
        ["ヘッダーなし", undefined],
        ["値が違う", "Bearer wrong-value!"],
        ["長さが違う", "Bearer s3cret"],
        ["Bearer が無い", "s3cret-value"],
    ])("%s なら 401 を返し、何もしない", async (_label, header) => {
        // Act
        const response = await GET(request(header));

        // Assert
        expect(response.status).toBe(401);
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(mockDeleteMany).not.toHaveBeenCalled();
    });

    it("正しいトークンなら未送信を最大 50 件送り、期限切れの既読を削除して件数を返す", async () => {
        // Act
        const response = await GET(request("Bearer s3cret-value"));

        // Assert
        expect(response.status).toBe(200);
        expect(mockDispatch).toHaveBeenCalledWith({ limit: 50 });
        const where = mockDeleteMany.mock.calls[0][0].where;
        expect(where.isRead).toBe(true);
        const ageMs = Date.now() - where.createdAt.lt.getTime();
        expect(Math.round(ageMs / (24 * 60 * 60 * 1000))).toBe(180);
        await expect(response.json()).resolves.toEqual({
            dispatch: { sent: 2, retried: 1, failed: 0, skipped: 0 },
            purged: 5,
        });
    });

    it("処理が失敗したら 500 を返し、内部のエラー文言は返さない", async () => {
        // Arrange
        mockDispatch.mockRejectedValue(new Error("connection string leaked"));

        // Act
        const response = await GET(request("Bearer s3cret-value"));

        // Assert
        expect(response.status).toBe(500);
        expect(await response.text()).not.toContain("connection string");
        expect(errSpy).toHaveBeenCalled();
    });
});
