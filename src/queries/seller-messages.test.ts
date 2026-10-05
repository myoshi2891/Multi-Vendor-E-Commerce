import { getSellerConversations } from "./message";
import { requireStoreOwner } from "@/lib/auth-guards";
import { db } from "@/lib/db";
jest.mock("@/lib/auth-guards", () => ({
    requireStoreOwner: jest.fn(),
    requireUser: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
    db: { conversation: { findMany: jest.fn() } },
}));
beforeEach(() => jest.clearAllMocks());
it("projects buyer display data and latest unread state within the owner store scope", async () => {
    jest.mocked(requireStoreOwner).mockResolvedValue({
        store: { id: "store" },
    } as Awaited<ReturnType<typeof requireStoreOwner>>);
    jest.mocked(db.conversation.findMany).mockResolvedValue([
        {
            id: "conv",
            userId: "buyer",
            updatedAt: new Date("2026-10-05"),
            store: { name: "Acme", logo: "", email: "private" },
            user: { name: "Buyer", picture: "", email: "private" },
            messages: [{ content: "Hi", senderId: "buyer", isRead: false }],
            orderId: "private",
        },
    ] as never);
    const [conversation] = await getSellerConversations("acme");
    expect(conversation).toEqual({
        id: "conv",
        userId: "buyer",
        updatedAt: "2026-10-05T00:00:00.000Z",
        store: { name: "Acme", logo: "" },
        user: { name: "Buyer", picture: "" },
        unreadLatest: true,
        messages: [{ content: "Hi" }],
    });
    expect(db.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
            where: { storeId: "store" },
            orderBy: { updatedAt: "desc" },
        })
    );
});
it("rejects unauthorized store access before reading conversations", async () => {
    jest.mocked(requireStoreOwner).mockRejectedValueOnce(
        new Error("Forbidden")
    );
    await expect(getSellerConversations("other")).rejects.toThrow("Forbidden");
    expect(db.conversation.findMany).not.toHaveBeenCalled();
});
