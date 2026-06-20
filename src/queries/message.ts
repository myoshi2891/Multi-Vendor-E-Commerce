"use server";

import { db } from "@/lib/db";
import { requireUser, requireStoreOwner } from "@/lib/auth-guards";
import { SendMessageSchema, StartConversationSchema } from "@/lib/schemas";

/**
 * src/queries/message.ts
 * Profile Messages（購入者↔販売者 1:1 スレッド）のサーバーアクション層。
 *
 * - getOrCreateConversation : (userId, storeId) 複合キーで会話を冪等起票（AC-M5）
 * - getUserConversations    : 購入者の会話一覧（requireUser スコープ・AC-M1）
 * - getStoreConversations   : 販売者の会話一覧（requireStoreOwner スコープ・AC-M2）
 * - getConversationMessages : 会話内メッセージ取得（参加者検証・AC-M3）
 * - sendMessage             : メッセージ送信（$transaction・AC-M4/M6）
 * - markConversationRead    : 相手発の未読のみ既読化（冪等・AC-M7）
 *
 * 認可は src/lib/auth-guards.ts のヘルパーと private assertParticipant を
 * 冒頭（try/catch の外）で呼ぶ。"Forbidden: ..." を汎用 DB エラーで上書きしないため。
 * 設計の正本: docs/design/profile-messages/design.md §3
 */

/**
 * 会話の参加者（購入者本人 or 店舗オーナー）であることを検証する。
 * IDOR 防止の中核。会話と店舗オーナーを1クエリで取得し、不一致なら throw する。
 *
 * @param conversationId - 検証対象の会話 ID
 * @param userId - 現在の認証ユーザー ID
 * @returns 検証済みの conversation（store.userId 含む）
 * @throws "Conversation not found." 会話が存在しない
 * @throws "Forbidden: not a participant of this conversation." 参加者でない
 */
async function assertParticipant(conversationId: string, userId: string) {
    const conversation = await db.conversation.findUnique({
        where: { id: conversationId },
        include: { store: { select: { userId: true } } },
    });
    if (!conversation) throw new Error("Conversation not found.");
    const isBuyer = conversation.userId === userId;
    const isSeller = conversation.store.userId === userId;
    if (!isBuyer && !isSeller) {
        throw new Error("Forbidden: not a participant of this conversation.");
    }
    return conversation;
}

/** 一覧 include 共通: 最新メッセージ1件 + 店舗の表示情報（name/logo） */
const conversationListInclude = {
    store: { select: { id: true, name: true, logo: true, url: true } },
    messages: { orderBy: { createdAt: "desc" }, take: 1 },
} as const;

/**
 * 販売者一覧 include: 共通 include に購入者（相手）の表示情報を追加する。
 * 販売者の左ペインは自店舗ではなく購入者で会話を識別するため user を含める。
 */
const storeConversationListInclude = {
    ...conversationListInclude,
    user: { select: { id: true, name: true, picture: true } },
} as const;

/**
 * @function getOrCreateConversation
 * @description 購入者と店舗の会話を (userId, storeId) 複合キーで冪等起票する。
 *              既存があればそれを返し、無ければ作成する（@@unique による冪等・AC-M5）。
 * @access USER（認証ユーザー本人を購入者として起票）
 */
export const getOrCreateConversation = async (
    storeId: string,
    orderId?: string
): Promise<{ id: string }> => {
    const user = await requireUser(); // 認可は try/catch の外

    const parsed = StartConversationSchema.safeParse({ storeId, orderId });
    if (!parsed.success) {
        throw new Error("会話の作成に必要な情報が不正です。");
    }

    // 注文起点で会話を起票する場合は、その注文が本人の注文であり、かつ
    // 対象店舗の明細を含むことを検証する（他人/他店の注文を紐付ける IDOR を防止）。
    // 所有権エラーを汎用 DB エラーで上書きしないよう、検証 throw は upsert の try の外で行う。
    if (parsed.data.orderId) {
        let order: { userId: string; groups: { storeId: string }[] } | null;
        try {
            order = await db.order.findUnique({
                where: { id: parsed.data.orderId },
                select: { userId: true, groups: { select: { storeId: true } } },
            });
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(
                    "[Message:getOrCreateConversation] Failed to verify order ownership",
                    { error: error.message, stack: error.stack }
                );
            } else {
                console.error(
                    "[Message:getOrCreateConversation] Unknown error verifying order",
                    { error }
                );
            }
            throw new Error("会話の作成に失敗しました。");
        }

        const ownsOrder = order?.userId === user.id;
        const orderInvolvesStore = order?.groups.some(
            (group) => group.storeId === storeId
        );
        if (!ownsOrder || !orderInvolvesStore) {
            throw new Error("Forbidden: order does not belong to this user.");
        }
    }

    try {
        const conversation = await db.conversation.upsert({
            where: { userId_storeId: { userId: user.id, storeId } },
            create: { userId: user.id, storeId, orderId: parsed.data.orderId },
            update: {},
            select: { id: true },
        });
        return { id: conversation.id };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[Message:getOrCreateConversation] Failed to upsert conversation",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error("[Message:getOrCreateConversation] Unknown error", {
                error,
            });
        }
        throw new Error("会話の作成に失敗しました。");
    }
};

/**
 * @function getUserConversations
 * @description 認証中の購入者が参加する会話一覧を取得する（最新メッセージ + 店舗情報付き・
 *              updatedAt 降順）。where を userId に固定して IDOR を防ぐ（AC-M1）。
 * @access USER
 */
export const getUserConversations = async () => {
    const user = await requireUser(); // 認可は try/catch の外
    try {
        return await db.conversation.findMany({
            where: { userId: user.id },
            include: conversationListInclude,
            orderBy: { updatedAt: "desc" },
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[Message:getUserConversations] Failed to fetch conversations",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error("[Message:getUserConversations] Unknown error", {
                error,
            });
        }
        throw new Error("会話一覧の取得に失敗しました。");
    }
};

/**
 * @function getStoreConversations
 * @description 店舗オーナーが受け取った会話一覧を取得する。requireStoreOwner で
 *              店舗所有権を検証してから storeId スコープで取得する（AC-M2）。
 * @access SELLER（店舗所有者のみ）
 */
export const getStoreConversations = async (storeUrl: string) => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch の外
    try {
        return await db.conversation.findMany({
            where: { storeId: store.id },
            include: storeConversationListInclude,
            orderBy: { updatedAt: "desc" },
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[Message:getStoreConversations] Failed to fetch conversations",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error("[Message:getStoreConversations] Unknown error", {
                error,
            });
        }
        throw new Error("会話一覧の取得に失敗しました。");
    }
};

/**
 * @function getConversationMessages
 * @description 会話内のメッセージを時系列昇順で取得する。参加者検証（assertParticipant）を
 *              try の外で行い、非参加者には副作用なく Forbidden を throw する（IDOR・AC-M3）。
 * @access USER（会話の参加者：購入者本人 or 店舗オーナーのみ）
 */
export const getConversationMessages = async (conversationId: string) => {
    const user = await requireUser(); // 認可は try/catch の外
    await assertParticipant(conversationId, user.id); // 参加者検証も try の外（Forbidden を隠さない）

    try {
        return await db.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[Message:getConversationMessages] Failed to fetch messages",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error("[Message:getConversationMessages] Unknown error", {
                error,
            });
        }
        throw new Error("メッセージの取得に失敗しました。");
    }
};

/**
 * @function sendMessage
 * @description 会話にメッセージを送信する。Zod で content を検証し、参加者検証後に
 *              Message 作成と Conversation.updatedAt 更新を単一 $transaction で原子的に行う
 *              （AC-M4/M6）。
 * @access USER（会話の参加者のみ）
 */
export const sendMessage = async (
    conversationId: string,
    content: string
): Promise<{ id: string }> => {
    const user = await requireUser(); // 認可は try/catch の外

    const parsed = SendMessageSchema.safeParse({ conversationId, content });
    if (!parsed.success) {
        throw new Error("メッセージの内容が不正です。");
    }

    await assertParticipant(conversationId, user.id); // 参加者検証も try の外

    try {
        // Message 作成 + Conversation.updatedAt を単一トランザクションで原子的に更新（AC-M6）
        const [message] = await db.$transaction([
            db.message.create({
                data: {
                    conversationId,
                    senderId: user.id,
                    content: parsed.data.content,
                },
                select: { id: true },
            }),
            db.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            }),
        ]);
        return { id: message.id };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[Message:sendMessage] Failed to send message", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error("[Message:sendMessage] Unknown error", { error });
        }
        throw new Error("メッセージの送信に失敗しました。");
    }
};

/**
 * @function markConversationRead
 * @description 会話内の「相手発」の未読メッセージのみを既読化する。senderId: { not: user.id }
 *              により自分発は対象外。updateMany なので再実行しても結果は変わらない
 *              （冪等・AC-M7）。
 * @access USER（会話の参加者のみ）
 */
export const markConversationRead = async (
    conversationId: string
): Promise<{ count: number }> => {
    const user = await requireUser(); // 認可は try/catch の外
    await assertParticipant(conversationId, user.id); // 参加者検証も try の外

    try {
        const result = await db.message.updateMany({
            where: {
                conversationId,
                senderId: { not: user.id }, // 相手発のみ（自分発は既読化しない）
                isRead: false,
            },
            data: { isRead: true, readAt: new Date() },
        });
        return { count: result.count };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "[Message:markConversationRead] Failed to mark as read",
                { error: error.message, stack: error.stack }
            );
        } else {
            console.error("[Message:markConversationRead] Unknown error", {
                error,
            });
        }
        throw new Error("既読の更新に失敗しました。");
    }
};
