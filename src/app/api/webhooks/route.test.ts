import { POST } from "./route";

// ---- モック設定 ----
const mockUpsert = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/lib/db", () => ({
    db: {
        user: {
            upsert: (...args: unknown[]) => mockUpsert(...args),
            delete: (...args: unknown[]) => mockDelete(...args),
        },
    },
}));

const mockUpdateUserMetadata = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({
    clerkClient: {
        users: {
            updateUserMetadata: (...args: unknown[]) =>
                mockUpdateUserMetadata(...args),
        },
    },
}));

// Svix Webhook モック
const mockVerify = jest.fn();
jest.mock("svix", () => ({
    Webhook: jest.fn().mockImplementation(() => ({
        verify: (...args: unknown[]) => mockVerify(...args),
    })),
}));

// next/headers モック
const mockHeadersMap = new Map<string, string>();
jest.mock("next/headers", () => ({
    headers: () => ({
        get: (key: string) => mockHeadersMap.get(key) ?? null,
    }),
}));

// 環境変数設定
const originalEnv = process.env;
beforeAll(() => {
    process.env = { ...originalEnv, WEBHOOK_SECRET: "test-webhook-secret" };
});
afterAll(() => {
    process.env = originalEnv;
});

beforeEach(() => {
    jest.clearAllMocks();
    mockHeadersMap.clear();
});

// ヘルパー: Request オブジェクト生成
const createWebhookRequest = (body: Record<string, unknown>) =>
    new Request("http://localhost:3000/api/webhooks", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });

// ヘルパー: Svixヘッダー設定
const setSvixHeaders = () => {
    mockHeadersMap.set("svix-id", "msg_test123");
    mockHeadersMap.set("svix-timestamp", "1234567890");
    mockHeadersMap.set("svix-signature", "v1,test-signature");
};

// ==================================================
// POST /api/webhooks
// ==================================================
describe("POST /api/webhooks", () => {
    describe("Svixヘッダー検証", () => {
        it("svix-idヘッダーがない場合400を返す", async () => {
            mockHeadersMap.set("svix-timestamp", "123");
            mockHeadersMap.set("svix-signature", "sig");

            const response = await POST(createWebhookRequest({}));

            expect(response.status).toBe(400);
        });

        it("svix-timestampヘッダーがない場合400を返す", async () => {
            mockHeadersMap.set("svix-id", "id");
            mockHeadersMap.set("svix-signature", "sig");

            const response = await POST(createWebhookRequest({}));

            expect(response.status).toBe(400);
        });

        it("svix-signatureヘッダーがない場合400を返す", async () => {
            mockHeadersMap.set("svix-id", "id");
            mockHeadersMap.set("svix-timestamp", "123");

            const response = await POST(createWebhookRequest({}));

            expect(response.status).toBe(400);
        });
    });

    describe("署名検証失敗", () => {
        it("Svix署名検証に失敗した場合400を返す", async () => {
            setSvixHeaders();
            mockVerify.mockImplementation(() => {
                throw new Error("Invalid signature");
            });
            const consoleErrorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            try {
                const response = await POST(
                    createWebhookRequest({ data: {} })
                );
                expect(response.status).toBe(400);
            } finally {
                consoleErrorSpy.mockRestore();
            }
        });
    });

    describe("user.created / user.updated", () => {
        beforeEach(() => {
            setSvixHeaders();
        });

        it("ユーザー作成時にDBにupsertする", async () => {
            const eventData = {
                data: {
                    id: "user_123",
                    first_name: "John",
                    last_name: "Smith",
                    email_addresses: [
                        { email_address: "john@example.com" },
                    ],
                    image_url: "https://example.com/avatar.jpg",
                },
            };
            mockVerify.mockReturnValue({
                type: "user.created",
                data: eventData.data,
            });
            mockUpsert.mockResolvedValue({
                id: "user_123",
                role: "USER",
            });
            mockUpdateUserMetadata.mockResolvedValue({});

            const response = await POST(createWebhookRequest(eventData));

            expect(response.status).toBe(200);
            expect(mockUpsert).toHaveBeenCalledWith({
                where: { email: "john@example.com" },
                update: expect.objectContaining({
                    id: "user_123",
                    name: "John Smith",
                    email: "john@example.com",
                }),
                create: expect.objectContaining({
                    id: "user_123",
                    name: "John Smith",
                    email: "john@example.com",
                    role: "USER",
                }),
            });
        });

        it("Clerkのメタデータにロールを設定する", async () => {
            const eventData = {
                data: {
                    id: "user_456",
                    first_name: "Jane",
                    last_name: "Doe",
                    email_addresses: [
                        { email_address: "jane@example.com" },
                    ],
                    image_url: "https://example.com/avatar.jpg",
                },
            };
            mockVerify.mockReturnValue({
                type: "user.created",
                data: eventData.data,
            });
            mockUpsert.mockResolvedValue({
                id: "user_456",
                role: "SELLER",
            });
            mockUpdateUserMetadata.mockResolvedValue({});

            await POST(createWebhookRequest(eventData));

            expect(mockUpdateUserMetadata).toHaveBeenCalledWith("user_456", {
                privateMetadata: { role: "SELLER" },
            });
        });

        it("email_addressesが空の場合400を返す", async () => {
            const eventData = {
                data: {
                    id: "user_no_email",
                    first_name: "No",
                    last_name: "Email",
                    email_addresses: [],
                    image_url: "https://example.com/avatar.jpg",
                },
            };
            mockVerify.mockReturnValue({
                type: "user.created",
                data: eventData.data,
            });
            const consoleErrorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            try {
                const response = await POST(createWebhookRequest(eventData));

                expect(response.status).toBe(400);
                expect(mockUpsert).not.toHaveBeenCalled();
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    "Webhook event missing primary email",
                    { userId: "user_no_email" }
                );
            } finally {
                consoleErrorSpy.mockRestore();
            }
        });

        it("ユーザー更新時もupsertが呼ばれる", async () => {
            const eventData = {
                data: {
                    id: "user_789",
                    first_name: "Updated",
                    last_name: "User",
                    email_addresses: [
                        { email_address: "updated@example.com" },
                    ],
                    image_url: "https://example.com/new-avatar.jpg",
                },
            };
            mockVerify.mockReturnValue({
                type: "user.updated",
                data: eventData.data,
            });
            mockUpsert.mockResolvedValue({ id: "user_789", role: "USER" });
            mockUpdateUserMetadata.mockResolvedValue({});

            const response = await POST(createWebhookRequest(eventData));

            expect(response.status).toBe(200);
            expect(mockUpsert).toHaveBeenCalled();
        });

        it("db.user.upsertが失敗した場合500を返す", async () => {
            const eventData = {
                data: {
                    id: "user_upsert_fail",
                    first_name: "Fail",
                    last_name: "User",
                    email_addresses: [
                        { email_address: "fail@example.com" },
                    ],
                    image_url: "https://example.com/avatar.jpg",
                },
            };
            mockVerify.mockReturnValue({
                type: "user.created",
                data: eventData.data,
            });
            mockUpsert.mockRejectedValue(new Error("DB upsert failed"));
            const consoleErrorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            try {
                const response = await POST(createWebhookRequest(eventData));

                expect(response.status).toBe(500);
                expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
                expect(consoleErrorSpy).toHaveBeenCalled();
            } finally {
                consoleErrorSpy.mockRestore();
            }
        });

        it("clerkClient.users.updateUserMetadataが失敗した場合500を返す", async () => {
            const eventData = {
                data: {
                    id: "user_meta_fail",
                    first_name: "Meta",
                    last_name: "Fail",
                    email_addresses: [
                        { email_address: "meta-fail@example.com" },
                    ],
                    image_url: "https://example.com/avatar.jpg",
                },
            };
            mockVerify.mockReturnValue({
                type: "user.created",
                data: eventData.data,
            });
            mockUpsert.mockResolvedValue({
                id: "user_meta_fail",
                role: "USER",
            });
            mockUpdateUserMetadata.mockRejectedValue(
                new Error("Clerk metadata update failed")
            );
            const consoleErrorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            try {
                const response = await POST(createWebhookRequest(eventData));

                expect(response.status).toBe(500);
                expect(consoleErrorSpy).toHaveBeenCalled();
            } finally {
                consoleErrorSpy.mockRestore();
            }
        });
    });

    describe("user.deleted", () => {
        beforeEach(() => {
            setSvixHeaders();
        });

        it("ユーザー削除時にDBから削除する", async () => {
            const eventData = {
                data: {
                    id: "user_to_delete",
                },
            };
            mockVerify.mockReturnValue({
                type: "user.deleted",
                data: eventData.data,
            });
            mockDelete.mockResolvedValue({ id: "user_to_delete" });

            const response = await POST(createWebhookRequest(eventData));

            expect(response.status).toBe(200);
            expect(mockDelete).toHaveBeenCalledWith({
                where: { id: "user_to_delete" },
            });
        });

        it("db.user.deleteが失敗した場合500を返す", async () => {
            const eventData = {
                data: {
                    id: "user_delete_fail",
                },
            };
            mockVerify.mockReturnValue({
                type: "user.deleted",
                data: eventData.data,
            });
            mockDelete.mockRejectedValue(new Error("DB delete failed"));
            const consoleErrorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            try {
                const response = await POST(createWebhookRequest(eventData));

                expect(response.status).toBe(500);
                expect(consoleErrorSpy).toHaveBeenCalled();
            } finally {
                consoleErrorSpy.mockRestore();
            }
        });
    });

    describe("正常レスポンス", () => {
        it("未知のイベントタイプでも200を返す", async () => {
            setSvixHeaders();
            mockVerify.mockReturnValue({ type: "unknown.event" });

            const response = await POST(
                createWebhookRequest({ data: {} })
            );

            expect(response.status).toBe(200);
        });
    });
});
