import { after } from "next/server";
import { dispatchPendingDeliveries } from "./dispatch";
import { scheduleDispatch } from "./schedule";

jest.mock("next/server", () => ({ after: jest.fn() }));
jest.mock("./dispatch", () => ({ dispatchPendingDeliveries: jest.fn() }));

const mockAfter = after as jest.Mock;
const mockDispatch = dispatchPendingDeliveries as jest.Mock;

describe("scheduleDispatch", () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => errorSpy.mockRestore());

    it("after() に送信を予約し、対象の配信 ID だけを送る", async () => {
        // Arrange
        mockDispatch.mockResolvedValue({ sent: 1 });

        // Act
        scheduleDispatch(["d-1", "d-2"]);
        const callback = mockAfter.mock.calls[0][0] as () => Promise<void>;
        await callback();

        // Assert
        expect(mockDispatch).toHaveBeenCalledWith({
            deliveryIds: ["d-1", "d-2"],
            limit: 2,
        });
    });

    it("送信が reject しても例外を外へ出さず、ログに残す", async () => {
        // Arrange
        mockDispatch.mockRejectedValue(new Error("provider down"));
        scheduleDispatch(["d-1"]);
        const callback = mockAfter.mock.calls[0][0] as () => Promise<void>;

        // Act & Assert
        await expect(callback()).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
            "[Notifications:scheduleDispatch] dispatch failed; sweeper will retry",
            expect.objectContaining({ error: "provider down" })
        );
    });

    it("after() が使えない環境（リクエスト外）でも throw しない", () => {
        // Arrange
        mockAfter.mockImplementation(() => {
            throw new Error("outside request scope");
        });

        // Act & Assert
        expect(() => scheduleDispatch(["d-1"])).not.toThrow();
        expect(errorSpy).toHaveBeenCalled();
    });

    it("配信 ID が空なら予約しない", () => {
        // Act
        scheduleDispatch([]);

        // Assert
        expect(mockAfter).not.toHaveBeenCalled();
    });
});
