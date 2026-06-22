import { currentUser } from "@clerk/nextjs/server";
import { createSupportTicket } from "./support";
import type { SupportTicketInput } from "@/lib/schemas";

// Prisma シングルトンをモック（SupportTicket.create のみ使用）
jest.mock("@/lib/db", () => ({
    db: {
        supportTicket: {
            create: jest.fn(),
        },
    },
}));

// Clerk: currentUser をモック（既定は未ログイン=null）
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

const mockDb = require("@/lib/db").db as {
    supportTicket: { create: jest.Mock };
};
const mockCurrentUser = currentUser as jest.Mock;

/** 有効な CONTACT 入力ファクトリ */
const validContact = (
    overrides: Partial<SupportTicketInput> = {}
): SupportTicketInput =>
    ({
        category: "CONTACT",
        name: "山田太郎",
        email: "taro@example.com",
        subject: "問い合わせ",
        message: "テスト本文です。",
        ...overrides,
    }) as SupportTicketInput;

describe("createSupportTicket", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrentUser.mockResolvedValue(null);
        mockDb.supportTicket.create.mockResolvedValue({ id: "ticket-1" });
        // catch ブロックの構造化ログ出力でテスト出力を汚さない
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // T-SF1 / AC-SF1
    it("有効な CONTACT 入力で category=CONTACT のチケットを作成し id を返す", async () => {
        // Arrange
        const input = validContact();

        // Act
        const result = await createSupportTicket(input);

        // Assert
        expect(mockDb.supportTicket.create).toHaveBeenCalledTimes(1);
        expect(mockDb.supportTicket.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ category: "CONTACT" }),
                select: { id: true },
            })
        );
        expect(result).toEqual({ id: "ticket-1" });
    });

    // T-SF2 / AC-SF2
    it("RETURN_REQUEST で orderId 欠落なら検証で reject し create を呼ばない", async () => {
        // Arrange
        const input = validContact({ category: "RETURN_REQUEST" });

        // Act / Assert
        await expect(createSupportTicket(input)).rejects.toThrow(
            "入力内容を確認してください。"
        );
        expect(mockDb.supportTicket.create).not.toHaveBeenCalled();
    });

    // T-SF3 / AC-SF3
    it("ログイン時は作成データの userId に現在ユーザー ID を設定する", async () => {
        // Arrange
        mockCurrentUser.mockResolvedValue({ id: "clerk-user-9" });
        const input = validContact();

        // Act
        await createSupportTicket(input);

        // Assert
        expect(mockDb.supportTicket.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ userId: "clerk-user-9" }),
            })
        );
    });

    // T-SF4 / AC-SF4
    it("未ログイン時は userId 未設定（undefined）で作成する", async () => {
        // Arrange
        mockCurrentUser.mockResolvedValue(null);
        const input = validContact();

        // Act
        await createSupportTicket(input);

        // Assert
        const callArg = mockDb.supportTicket.create.mock.calls[0][0] as {
            data: { userId?: string };
        };
        expect(callArg.data.userId).toBeUndefined();
    });

    // T-SF7 — currentUser が Error を throw してもゲスト送信として続行する
    it("currentUser が Error を throw しても userId 未設定で作成し id を返す", async () => {
        // Arrange
        mockCurrentUser.mockRejectedValue(new Error("clerk down"));
        const input = validContact();

        // Act
        const result = await createSupportTicket(input);

        // Assert
        const callArg = mockDb.supportTicket.create.mock.calls[0][0] as {
            data: { userId?: string };
        };
        expect(callArg.data.userId).toBeUndefined();
        expect(result).toEqual({ id: "ticket-1" });
    });

    // T-SF8 — currentUser が非 Error 値を throw した場合（unknown 分岐）も続行する
    it("currentUser が非 Error を throw しても作成を続行する", async () => {
        // Arrange
        mockCurrentUser.mockRejectedValue("string failure");
        const input = validContact();

        // Act
        const result = await createSupportTicket(input);

        // Assert
        expect(mockDb.supportTicket.create).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ id: "ticket-1" });
    });

    // T-SF9 — create が Error を throw したら汎用エラーで reject する
    it("create が Error を throw すると送信失敗エラーで reject する", async () => {
        // Arrange
        mockDb.supportTicket.create.mockRejectedValue(new Error("db error"));
        const input = validContact();

        // Act / Assert
        await expect(createSupportTicket(input)).rejects.toThrow(
            "送信に失敗しました。時間をおいて再度お試しください。"
        );
    });

    // T-SF10 — create が非 Error 値を throw した場合（unknown 分岐）も汎用エラーで reject する
    it("create が非 Error を throw しても送信失敗エラーで reject する", async () => {
        // Arrange
        mockDb.supportTicket.create.mockRejectedValue({ code: "P2002" });
        const input = validContact();

        // Act / Assert
        await expect(createSupportTicket(input)).rejects.toThrow(
            "送信に失敗しました。時間をおいて再度お試しください。"
        );
    });
});
