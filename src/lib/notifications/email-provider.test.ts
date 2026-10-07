import { getEmailProvider } from "./email-provider";

describe("getEmailProvider", () => {
    const original = process.env.EMAIL_PROVIDER;
    afterEach(() => {
        if (original === undefined) delete process.env.EMAIL_PROVIDER;
        else process.env.EMAIL_PROVIDER = original;
    });

    it("未設定なら stub を返す（ローカル・CI では実送信しない）", () => {
        // Arrange
        delete process.env.EMAIL_PROVIDER;

        // Act
        const provider = getEmailProvider();

        // Assert
        expect(provider.name).toBe("stub");
    });

    it("空白だけの値も未設定として扱う", () => {
        // Arrange
        process.env.EMAIL_PROVIDER = "   ";

        // Act & Assert
        expect(getEmailProvider().name).toBe("stub");
    });

    it("未知の値は throw する（設定ミスを黙って stub にしない）", () => {
        // Arrange
        process.env.EMAIL_PROVIDER = "sendgird";

        // Act & Assert
        expect(() => getEmailProvider()).toThrow(
            "[Notifications:getEmailProvider] unknown EMAIL_PROVIDER"
        );
    });
});
