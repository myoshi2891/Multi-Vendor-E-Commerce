import { logError } from "./log";

describe("logError", () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it("logs Error values with their message and stack", () => {
        const error = new Error("bad");

        logError("[X:y] boom", error);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "[X:y] boom",
            expect.objectContaining({
                error: "bad",
                stack: expect.any(String),
            })
        );
    });

    it("logs non-Error values without assuming error properties", () => {
        logError("[X:y] boom", "raw-string");

        expect(consoleErrorSpy).toHaveBeenCalledWith("[X:y] boom", {
            error: "raw-string",
        });
    });
});
