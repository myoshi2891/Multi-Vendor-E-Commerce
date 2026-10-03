import * as queries from "./message";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
jest.mock("@/lib/auth-guards", () => ({
    requireUser: jest.fn(),
    requireStoreOwner: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
    db: {
        conversation: { findMany: jest.fn(), findUnique: jest.fn() },
        message: { findMany: jest.fn() },
    },
}));
const api = queries as unknown as {
    getProfileConversations: () => Promise<unknown>;
    getProfileConversationMessages: (id: string) => Promise<unknown>;
};
const mockDb = db as unknown as {
    conversation: { findMany: jest.Mock; findUnique: jest.Mock };
    message: { findMany: jest.Mock };
};
beforeEach(() => {
    jest.resetAllMocks();
    (requireUser as jest.Mock).mockResolvedValue({ id: "buyer" });
});
it("projects the owned conversation list without private store fields", async () => {
    mockDb.conversation.findMany.mockResolvedValue([
        {
            id: "conv",
            userId: "buyer",
            updatedAt: new Date("2026-10-01"),
            store: {
                id: "store",
                name: "Acme",
                logo: "",
                url: "acme",
                email: "private",
            },
            messages: [
                { content: "Latest", senderId: "private", id: "private" },
            ],
            orderId: "private",
        },
    ]);
    await expect(api.getProfileConversations()).resolves.toEqual([
        {
            id: "conv",
            userId: "buyer",
            updatedAt: "2026-10-01T00:00:00.000Z",
            store: { name: "Acme", logo: "" },
            messages: [{ content: "Latest" }],
        },
    ]);
    expect(mockDb.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
            where: { userId: "buyer" },
            orderBy: { updatedAt: "desc" },
        })
    );
});
it("projects chronological messages after participant verification", async () => {
    mockDb.conversation.findUnique.mockResolvedValue({
        userId: "buyer",
        store: { userId: "seller" },
    });
    mockDb.message.findMany.mockResolvedValue([
        {
            id: "m",
            senderId: "seller",
            content: "Hello",
            createdAt: new Date("2026-10-01"),
            readAt: new Date(),
            isRead: true,
            conversationId: "private",
        },
    ]);
    await expect(api.getProfileConversationMessages("conv")).resolves.toEqual([
        {
            id: "m",
            senderId: "seller",
            content: "Hello",
            createdAt: "2026-10-01T00:00:00.000Z",
        },
    ]);
    expect(mockDb.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "conv" } })
    );
    expect(mockDb.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: "conv" },
        orderBy: { createdAt: "asc" },
    });
});
it("rejects guests before any database lookup", async () => {
    (requireUser as jest.Mock).mockRejectedValue(new Error("Unauthenticated."));
    await expect(api.getProfileConversations()).rejects.toThrow(
        "Unauthenticated"
    );
    await expect(api.getProfileConversationMessages("conv")).rejects.toThrow(
        "Unauthenticated"
    );
    expect(mockDb.conversation.findMany).not.toHaveBeenCalled();
    expect(mockDb.conversation.findUnique).not.toHaveBeenCalled();
    expect(mockDb.message.findMany).not.toHaveBeenCalled();
});
it("rejects non-participants before accessing message data", async () => {
    mockDb.conversation.findUnique.mockResolvedValue({
        userId: "other",
        store: { userId: "seller" },
    });
    await expect(api.getProfileConversationMessages("conv")).rejects.toThrow(
        "Forbidden"
    );
    expect(mockDb.message.findMany).not.toHaveBeenCalled();
});
