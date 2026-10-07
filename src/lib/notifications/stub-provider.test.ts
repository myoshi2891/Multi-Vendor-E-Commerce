import { createStubEmailProvider } from "./stub-provider";

describe("createStubEmailProvider", () => {
    const input = {
        to: "a@example.com",
        templateKey: "order.group.shipped" as const,
        params: { storeName: "Acme" },
        idempotencyKey: "key-1:email",
    };

    it("送信内容を記録し、providerMessageId を返す", async () => {
        // Arrange
        const provider = createStubEmailProvider();

        // Act
        const result = await provider.send(input);

        // Assert
        expect(result).toEqual({ ok: true, providerMessageId: "stub-1" });
        expect(provider.sent).toHaveLength(1);
        expect(provider.sent[0]?.idempotencyKey).toBe("key-1:email");
    });

    it("同じ冪等キーの再送は新しく記録せず、前回の結果を返す（Resend と同じ挙動）", async () => {
        // Arrange
        const provider = createStubEmailProvider();
        await provider.send(input);

        // Act
        const second = await provider.send(input);

        // Assert
        expect(second).toEqual({ ok: true, providerMessageId: "stub-1" });
        expect(provider.sent).toHaveLength(1);
    });
});
