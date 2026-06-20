import { currentUser } from "@clerk/nextjs/server";
import {
    getOrCreateConversation,
    getUserConversations,
    getStoreConversations,
    getConversationMessages,
    sendMessage,
    markConversationRead,
} from "./message";
import { TEST_CONFIG } from "../config/test-config";

// Mock the database
jest.mock("@/lib/db", () => ({
    db: {
        conversation: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
        },
        message: {
            findMany: jest.fn(),
            create: jest.fn(),
            updateMany: jest.fn(),
        },
        store: {
            findUnique: jest.fn(),
        },
        order: {
            findUnique: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

// Mock Clerk
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

const mockDb = require("@/lib/db").db as {
    conversation: {
        findUnique: jest.Mock;
        findMany: jest.Mock;
        upsert: jest.Mock;
        update: jest.Mock;
    };
    message: { findMany: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
    store: { findUnique: jest.Mock };
    order: { findUnique: jest.Mock };
    $transaction: jest.Mock;
};

/** 認可ガード関連の共通エラーメッセージ */
const ERRORS = {
    UNAUTHENTICATED: "Unauthenticated.",
    NOT_SELLER: "Only sellers can perform this action.",
    NOT_OWNER: "Forbidden: store not owned by current user.",
    NOT_PARTICIPANT: "Forbidden: not a participant of this conversation.",
    CONVERSATION_NOT_FOUND: "Conversation not found.",
} as const;

const USER_ID = TEST_CONFIG.DEFAULT_USER_ID; // "user123"
const STORE_ID = TEST_CONFIG.DEFAULT_STORE_ID; // "store123"
const STORE_URL = TEST_CONFIG.TEST_STORE_URL; // "test-store"

/** テストデータファクトリー */
const TestData = {
    /** 認証ユーザー（デフォルト USER ロール） */
    user: (role = "USER") => ({
        id: USER_ID,
        privateMetadata: { role },
    }),
    ownedStore: () => ({
        id: STORE_ID,
        url: STORE_URL,
        userId: USER_ID,
    }),
    /** user123 が購入者として参加する会話 */
    buyerConversation: () => ({
        id: "conv-1",
        userId: USER_ID,
        store: { userId: "seller-999" },
    }),
    /** user123 が店舗オーナーとして参加する会話 */
    sellerConversation: () => ({
        id: "conv-2",
        userId: "buyer-888",
        store: { userId: USER_ID },
    }),
    /** user123 が参加しない他者間の会話（IDOR 対象） */
    foreignConversation: () => ({
        id: "conv-x",
        userId: "buyer-888",
        store: { userId: "seller-999" },
    }),
};

const mockCurrentUser = (user: Record<string, unknown> | null) => {
    (currentUser as jest.Mock).mockResolvedValue(user);
};

/** beforeEach で spy 済みの console.error を jest.Mock として型安全に参照する */
const consoleErrorMock = () => console.error as unknown as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ==================================================
// getUserConversations — 認可・正常系（AC-M1）
// ==================================================
describe("getUserConversations", () => {
    it("未認証ユーザーの場合 Unauthenticated. をスローする（AC-M1）", async () => {
        mockCurrentUser(null);

        await expect(getUserConversations()).rejects.toThrow(
            ERRORS.UNAUTHENTICATED
        );
        expect(mockDb.conversation.findMany).not.toHaveBeenCalled();
    });

    it("userId スコープで会話一覧を updatedAt 降順取得する", async () => {
        mockCurrentUser(TestData.user());
        mockDb.conversation.findMany.mockResolvedValue([]);

        await getUserConversations();

        expect(mockDb.conversation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId: USER_ID },
                orderBy: { updatedAt: "desc" },
            })
        );
    });

    it("DB エラー時は汎用メッセージにラップしてスローする", async () => {
        mockCurrentUser(TestData.user());
        mockDb.conversation.findMany.mockRejectedValue(new Error("db down"));

        await expect(getUserConversations()).rejects.toThrow(
            "会話一覧の取得に失敗しました。"
        );
    });
});

// ==================================================
// getStoreConversations — 認可・正常系（AC-M2）
// ==================================================
describe("getStoreConversations", () => {
    it("SELLER ロール以外の場合エラーをスローする", async () => {
        mockCurrentUser(TestData.user("USER"));

        await expect(getStoreConversations(STORE_URL)).rejects.toThrow(
            ERRORS.NOT_SELLER
        );
    });

    it("店舗を所有していない場合 Forbidden をスローする（AC-M2）", async () => {
        mockCurrentUser(TestData.user("SELLER"));
        mockDb.store.findUnique.mockResolvedValue(null);

        await expect(getStoreConversations(STORE_URL)).rejects.toThrow(
            ERRORS.NOT_OWNER
        );
        expect(mockDb.conversation.findMany).not.toHaveBeenCalled();
    });

    it("storeId スコープで会話一覧を取得する", async () => {
        mockCurrentUser(TestData.user("SELLER"));
        mockDb.store.findUnique.mockResolvedValue(TestData.ownedStore());
        mockDb.conversation.findMany.mockResolvedValue([]);

        await getStoreConversations(STORE_URL);

        expect(mockDb.conversation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { storeId: STORE_ID },
                orderBy: { updatedAt: "desc" },
                // 販売者一覧は購入者（相手）の表示情報を含める（左ペインで会話を識別するため）
                include: expect.objectContaining({ user: expect.anything() }),
            })
        );
    });
});

// ==================================================
// getConversationMessages — IDOR 3階層（AC-M3）
// ==================================================
describe("getConversationMessages", () => {
    it("未認証ユーザーの場合 Unauthenticated. をスローする", async () => {
        mockCurrentUser(null);

        await expect(getConversationMessages("conv-1")).rejects.toThrow(
            ERRORS.UNAUTHENTICATED
        );
    });

    it("会話が存在しない場合 Conversation not found. をスローする", async () => {
        mockCurrentUser(TestData.user());
        mockDb.conversation.findUnique.mockResolvedValue(null);

        await expect(getConversationMessages("missing")).rejects.toThrow(
            ERRORS.CONVERSATION_NOT_FOUND
        );
    });

    describe("IDOR 防止（非参加者）", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.findUnique.mockResolvedValue(
                TestData.foreignConversation()
            );
        });

        it("(a) 非参加者は Forbidden をスローする", async () => {
            await expect(getConversationMessages("conv-x")).rejects.toThrow(
                ERRORS.NOT_PARTICIPANT
            );
        });

        it("(b) 参加者検証は store.userId を include した findUnique で行う", async () => {
            await expect(getConversationMessages("conv-x")).rejects.toThrow();

            expect(mockDb.conversation.findUnique).toHaveBeenCalledWith({
                where: { id: "conv-x" },
                include: { store: { select: { userId: true } } },
            });
        });

        it("(c) 非参加者には副作用がない（message.findMany を呼ばない）", async () => {
            await expect(getConversationMessages("conv-x")).rejects.toThrow();

            expect(mockDb.message.findMany).not.toHaveBeenCalled();
        });
    });

    it("購入者参加者はメッセージを createdAt 昇順取得する", async () => {
        mockCurrentUser(TestData.user());
        mockDb.conversation.findUnique.mockResolvedValue(
            TestData.buyerConversation()
        );
        mockDb.message.findMany.mockResolvedValue([]);

        await getConversationMessages("conv-1");

        expect(mockDb.message.findMany).toHaveBeenCalledWith({
            where: { conversationId: "conv-1" },
            orderBy: { createdAt: "asc" },
        });
    });

    it("店舗オーナー参加者もメッセージを取得できる", async () => {
        mockCurrentUser(TestData.user());
        mockDb.conversation.findUnique.mockResolvedValue(
            TestData.sellerConversation()
        );
        mockDb.message.findMany.mockResolvedValue([]);

        await getConversationMessages("conv-2");

        expect(mockDb.message.findMany).toHaveBeenCalled();
    });
});

// ==================================================
// sendMessage — Zod 境界・IDOR・$transaction（AC-M3/M4/M6）
// ==================================================
describe("sendMessage", () => {
    describe("入力バリデーション（AC-M4）", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.user());
        });

        it("空文字 content は Zod で弾き、$transaction を呼ばない", async () => {
            await expect(sendMessage("conv-1", "")).rejects.toThrow(
                "メッセージの内容が不正です。"
            );
            expect(mockDb.$transaction).not.toHaveBeenCalled();
            // バリデーションは参加者検証より前なので findUnique も呼ばれない
            expect(mockDb.conversation.findUnique).not.toHaveBeenCalled();
        });

        it("2001 文字 content は Zod で弾き、$transaction を呼ばない", async () => {
            await expect(
                sendMessage("conv-1", "a".repeat(2001))
            ).rejects.toThrow("メッセージの内容が不正です。");
            expect(mockDb.$transaction).not.toHaveBeenCalled();
        });

        it("2000 文字 content（境界）は受理する", async () => {
            mockDb.conversation.findUnique.mockResolvedValue(
                TestData.buyerConversation()
            );
            mockDb.$transaction.mockResolvedValue([{ id: "msg-1" }, {}]);

            const result = await sendMessage("conv-1", "a".repeat(2000));

            expect(result).toEqual({ id: "msg-1" });
        });
    });

    describe("IDOR 防止（非参加者・AC-M3）", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.findUnique.mockResolvedValue(
                TestData.foreignConversation()
            );
        });

        it("(a) 非参加者は Forbidden をスローする", async () => {
            await expect(sendMessage("conv-x", "hi")).rejects.toThrow(
                ERRORS.NOT_PARTICIPANT
            );
        });

        it("(b) 参加者検証は store.userId を include した findUnique で行う", async () => {
            await expect(sendMessage("conv-x", "hi")).rejects.toThrow();

            expect(mockDb.conversation.findUnique).toHaveBeenCalledWith({
                where: { id: "conv-x" },
                include: { store: { select: { userId: true } } },
            });
        });

        it("(c) 非参加者には副作用がない（$transaction/message.create を呼ばない）", async () => {
            await expect(sendMessage("conv-x", "hi")).rejects.toThrow();

            expect(mockDb.$transaction).not.toHaveBeenCalled();
            expect(mockDb.message.create).not.toHaveBeenCalled();
        });
    });

    describe("正常系・原子性（AC-M6）", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.findUnique.mockResolvedValue(
                TestData.buyerConversation()
            );
        });

        it("Message 作成 + Conversation.updatedAt 更新を単一 $transaction で行う", async () => {
            mockDb.$transaction.mockResolvedValue([{ id: "msg-1" }, {}]);

            const result = await sendMessage("conv-1", "hello");

            expect(result).toEqual({ id: "msg-1" });
            // $transaction が一度だけ呼ばれ、両クエリが配列で同梱される
            expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
            expect(mockDb.message.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {
                        conversationId: "conv-1",
                        senderId: USER_ID,
                        content: "hello",
                    },
                    select: { id: true },
                })
            );
            expect(mockDb.conversation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "conv-1" },
                    data: expect.objectContaining({
                        updatedAt: expect.any(Date),
                    }),
                })
            );
        });

        it("$transaction 失敗時は汎用メッセージにラップしてスローする", async () => {
            mockDb.$transaction.mockRejectedValue(new Error("tx failed"));

            await expect(sendMessage("conv-1", "hello")).rejects.toThrow(
                "メッセージの送信に失敗しました。"
            );
        });
    });
});

// ==================================================
// getOrCreateConversation — 冪等 upsert（AC-M5）
// ==================================================
describe("getOrCreateConversation", () => {
    it("未認証ユーザーの場合 Unauthenticated. をスローする", async () => {
        mockCurrentUser(null);

        await expect(getOrCreateConversation(STORE_ID)).rejects.toThrow(
            ERRORS.UNAUTHENTICATED
        );
    });

    it("storeId が空の場合 Zod で弾き、upsert を呼ばない", async () => {
        mockCurrentUser(TestData.user());

        await expect(getOrCreateConversation("")).rejects.toThrow(
            "会話の作成に必要な情報が不正です。"
        );
        expect(mockDb.conversation.upsert).not.toHaveBeenCalled();
    });

    it("(userId, storeId) 複合キーで upsert し、冪等に同一会話へ収束する（AC-M5）", async () => {
        mockCurrentUser(TestData.user());
        mockDb.conversation.upsert.mockResolvedValue({ id: "conv-1" });

        const first = await getOrCreateConversation(STORE_ID);
        const second = await getOrCreateConversation(STORE_ID);

        // 2回呼んでも同じ会話 ID（@@unique 複合キーによる冪等）
        expect(first).toEqual({ id: "conv-1" });
        expect(second).toEqual({ id: "conv-1" });
        expect(mockDb.conversation.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    userId_storeId: { userId: USER_ID, storeId: STORE_ID },
                },
                create: expect.objectContaining({
                    userId: USER_ID,
                    storeId: STORE_ID,
                }),
                update: {},
            })
        );
    });

    it("orderId を指定すると所有権検証後に create に含める", async () => {
        mockCurrentUser(TestData.user());
        // 本人の注文 + 対象店舗の明細を含む（所有権 OK）
        mockDb.order.findUnique.mockResolvedValue({
            userId: USER_ID,
            groups: [{ storeId: STORE_ID }],
        });
        mockDb.conversation.upsert.mockResolvedValue({ id: "conv-1" });

        await getOrCreateConversation(STORE_ID, "order-1");

        expect(mockDb.order.findUnique).toHaveBeenCalledWith({
            where: { id: "order-1" },
            select: { userId: true, groups: { select: { storeId: true } } },
        });
        expect(mockDb.conversation.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ orderId: "order-1" }),
            })
        );
    });

    it("他人の注文を紐付けようとすると Forbidden で弾き upsert を呼ばない（IDOR 防止）", async () => {
        mockCurrentUser(TestData.user());
        mockDb.order.findUnique.mockResolvedValue({
            userId: "other-user",
            groups: [{ storeId: STORE_ID }],
        });

        await expect(
            getOrCreateConversation(STORE_ID, "order-1")
        ).rejects.toThrow("Forbidden: order does not belong to this user.");
        expect(mockDb.conversation.upsert).not.toHaveBeenCalled();
    });

    it("対象店舗の明細を含まない注文を弾き upsert を呼ばない", async () => {
        mockCurrentUser(TestData.user());
        mockDb.order.findUnique.mockResolvedValue({
            userId: USER_ID,
            groups: [{ storeId: "other-store" }],
        });

        await expect(
            getOrCreateConversation(STORE_ID, "order-1")
        ).rejects.toThrow("Forbidden: order does not belong to this user.");
        expect(mockDb.conversation.upsert).not.toHaveBeenCalled();
    });

    it("注文が存在しない（null）場合は所有権なしとして Forbidden で弾く（order?. の null 経路）", async () => {
        mockCurrentUser(TestData.user());
        mockDb.order.findUnique.mockResolvedValue(null);

        await expect(
            getOrCreateConversation(STORE_ID, "order-1")
        ).rejects.toThrow("Forbidden: order does not belong to this user.");
        expect(mockDb.conversation.upsert).not.toHaveBeenCalled();
    });
});

// ==================================================
// markConversationRead — 相手発のみ・冪等（AC-M3/M7）
// ==================================================
describe("markConversationRead", () => {
    describe("IDOR 防止（非参加者・AC-M3）", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.findUnique.mockResolvedValue(
                TestData.foreignConversation()
            );
        });

        it("(a) 非参加者は Forbidden をスローする", async () => {
            await expect(markConversationRead("conv-x")).rejects.toThrow(
                ERRORS.NOT_PARTICIPANT
            );
        });

        it("(b) 参加者検証は store.userId を include した findUnique で行う", async () => {
            await expect(markConversationRead("conv-x")).rejects.toThrow();

            expect(mockDb.conversation.findUnique).toHaveBeenCalledWith({
                where: { id: "conv-x" },
                include: { store: { select: { userId: true } } },
            });
        });

        it("(c) 非参加者には副作用がない（updateMany を呼ばない）", async () => {
            await expect(markConversationRead("conv-x")).rejects.toThrow();

            expect(mockDb.message.updateMany).not.toHaveBeenCalled();
        });
    });

    describe("相手発のみ既読化・冪等（AC-M7）", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.findUnique.mockResolvedValue(
                TestData.buyerConversation()
            );
        });

        it("自分発を除外（senderId: not）した未読のみを既読化する", async () => {
            mockDb.message.updateMany.mockResolvedValue({ count: 2 });

            const result = await markConversationRead("conv-1");

            expect(result).toEqual({ count: 2 });
            expect(mockDb.message.updateMany).toHaveBeenCalledWith({
                where: {
                    conversationId: "conv-1",
                    senderId: { not: USER_ID },
                    isRead: false,
                },
                data: { isRead: true, readAt: expect.any(Date) },
            });
        });

        it("既読対象が無くても（冪等・count=0）成功する", async () => {
            mockDb.message.updateMany.mockResolvedValue({ count: 0 });

            const result = await markConversationRead("conv-1");

            expect(result).toEqual({ count: 0 });
        });

        it("DB エラー時は汎用メッセージにラップしてスローする", async () => {
            mockDb.message.updateMany.mockRejectedValue(new Error("db down"));

            await expect(markConversationRead("conv-1")).rejects.toThrow(
                "既読の更新に失敗しました。"
            );
        });
    });
});

// ==================================================
// catch 分岐網羅 — Error / unknown 両系統 + 未テストの DB エラー経路
// 各 server action の try/catch は instanceof Error の真/偽で別ログを出す。既存テストは
// 真ブランチ（new Error）のみ踏むため、ここで偽ブランチ（非 Error reject）と未テストの
// DB エラー経路を埋めて catch を全分岐カバーする。
// ==================================================
describe("catch 分岐網羅（Error / unknown 両系統）", () => {
    /** 参加者検証を通すための共通モック（buyer として conv-1 に参加） */
    const mockParticipant = () => {
        mockCurrentUser(TestData.user());
        mockDb.conversation.findUnique.mockResolvedValue(
            TestData.buyerConversation()
        );
    };

    describe("getUserConversations", () => {
        it("非 Error の reject は unknown ブランチでログし汎用メッセージにラップする", async () => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.findMany.mockRejectedValue("db string error");

            await expect(getUserConversations()).rejects.toThrow(
                "会話一覧の取得に失敗しました。"
            );
            expect(consoleErrorMock()).toHaveBeenCalledWith(
                "[Message:getUserConversations] Unknown error",
                { error: "db string error" }
            );
        });
    });

    describe("getStoreConversations", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.user("SELLER"));
            mockDb.store.findUnique.mockResolvedValue(TestData.ownedStore());
        });

        it("DB エラー（Error）時は汎用メッセージにラップしてスローする", async () => {
            mockDb.conversation.findMany.mockRejectedValue(new Error("db down"));

            await expect(getStoreConversations(STORE_URL)).rejects.toThrow(
                "会話一覧の取得に失敗しました。"
            );
        });

        it("非 Error の reject は unknown ブランチでログする", async () => {
            mockDb.conversation.findMany.mockRejectedValue({ code: "P2024" });

            await expect(getStoreConversations(STORE_URL)).rejects.toThrow(
                "会話一覧の取得に失敗しました。"
            );
            expect(consoleErrorMock()).toHaveBeenCalledWith(
                "[Message:getStoreConversations] Unknown error",
                { error: { code: "P2024" } }
            );
        });
    });

    describe("getConversationMessages", () => {
        it("findMany が Error で reject すると汎用メッセージにラップする", async () => {
            mockParticipant();
            mockDb.message.findMany.mockRejectedValue(new Error("db down"));

            await expect(getConversationMessages("conv-1")).rejects.toThrow(
                "メッセージの取得に失敗しました。"
            );
        });

        it("findMany が非 Error で reject すると unknown ブランチでログする", async () => {
            mockParticipant();
            mockDb.message.findMany.mockRejectedValue("boom");

            await expect(getConversationMessages("conv-1")).rejects.toThrow(
                "メッセージの取得に失敗しました。"
            );
            expect(consoleErrorMock()).toHaveBeenCalledWith(
                "[Message:getConversationMessages] Unknown error",
                { error: "boom" }
            );
        });
    });

    describe("sendMessage", () => {
        it("$transaction が非 Error で reject すると unknown ブランチでログする", async () => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.findUnique.mockResolvedValue(
                TestData.buyerConversation()
            );
            mockDb.$transaction.mockRejectedValue("tx boom");

            await expect(sendMessage("conv-1", "hi")).rejects.toThrow(
                "メッセージの送信に失敗しました。"
            );
            expect(consoleErrorMock()).toHaveBeenCalledWith(
                "[Message:sendMessage] Unknown error",
                { error: "tx boom" }
            );
        });
    });

    describe("markConversationRead", () => {
        it("updateMany が非 Error で reject すると unknown ブランチでログする", async () => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.findUnique.mockResolvedValue(
                TestData.buyerConversation()
            );
            mockDb.message.updateMany.mockRejectedValue(123);

            await expect(markConversationRead("conv-1")).rejects.toThrow(
                "既読の更新に失敗しました。"
            );
            expect(consoleErrorMock()).toHaveBeenCalledWith(
                "[Message:markConversationRead] Unknown error",
                { error: 123 }
            );
        });
    });

    describe("getOrCreateConversation", () => {
        it("order 検証の findUnique が Error で reject すると汎用メッセージにラップし upsert を呼ばない", async () => {
            mockCurrentUser(TestData.user());
            mockDb.order.findUnique.mockRejectedValue(
                new Error("order db down")
            );

            await expect(
                getOrCreateConversation(STORE_ID, "order-1")
            ).rejects.toThrow("会話の作成に失敗しました。");
            expect(mockDb.conversation.upsert).not.toHaveBeenCalled();
        });

        it("order 検証の findUnique が非 Error で reject すると unknown ブランチでログする", async () => {
            mockCurrentUser(TestData.user());
            mockDb.order.findUnique.mockRejectedValue("order boom");

            await expect(
                getOrCreateConversation(STORE_ID, "order-1")
            ).rejects.toThrow("会話の作成に失敗しました。");
            expect(consoleErrorMock()).toHaveBeenCalledWith(
                "[Message:getOrCreateConversation] Unknown error verifying order",
                { error: "order boom" }
            );
        });

        it("upsert が Error で reject すると汎用メッセージにラップする", async () => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.upsert.mockRejectedValue(
                new Error("upsert fail")
            );

            await expect(getOrCreateConversation(STORE_ID)).rejects.toThrow(
                "会話の作成に失敗しました。"
            );
        });

        it("upsert が非 Error で reject すると unknown ブランチでログする", async () => {
            mockCurrentUser(TestData.user());
            mockDb.conversation.upsert.mockRejectedValue(null);

            await expect(getOrCreateConversation(STORE_ID)).rejects.toThrow(
                "会話の作成に失敗しました。"
            );
            expect(consoleErrorMock()).toHaveBeenCalledWith(
                "[Message:getOrCreateConversation] Unknown error",
                { error: null }
            );
        });
    });
});
