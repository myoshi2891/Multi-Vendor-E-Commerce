"use client";

import ConversationThread from "@/components/store/profile/messages/conversation-thread";
import { MessageType, StoreConversationWithLatest } from "@/lib/types";
import {
    getConversationMessages,
    markConversationRead,
} from "@/queries/message";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useState } from "react";

// ポーリング間隔（NFR-M5・design.md 判断4・購入者コンテナと同一）
const POLL_INTERVAL_MS = 5000;

/**
 * 販売者向けメッセージ画面のコンテナ（2ペイン: 会話一覧 + スレッド）。
 *
 * 購入者向け MessagesContainer と同型だが、左ペインは自店舗ではなく相手（購入者）の
 * name/picture で会話を識別する（販売者にとって店舗は常に自分のため）。右ペインは
 * {@link ConversationThread} を流用する（バブル振り分けは購入者発か否かのみで判定し
 * 閲覧者に依存しない・design.md §4.4 / 判断2）。
 *
 * 選択中の会話を 5 秒間隔でポーリングし、tech.md の cancelled パターンで再選択/
 * アンマウント時のレースを防ぐ。`document.hidden`（タブ背面化）時は停止する。
 * 会話選択・送信成功時には相手発の未読を既読化する（markConversationRead）。
 *
 * @param props.initialConversations - サーバーで取得した会話一覧（updatedAt 降順）
 */
export default function SellerMessagesContainer({
    initialConversations,
}: {
    initialConversations: StoreConversationWithLatest[];
}) {
    const [conversations] =
        useState<StoreConversationWithLatest[]>(initialConversations);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<MessageType[]>([]);

    const selected = conversations.find((c) => c.id === selectedId) ?? null;

    useEffect(() => {
        if (!selectedId) return; // 未選択時は初期値 [] のまま
        let cancelled = false;

        const poll = async () => {
            if (document.hidden) return; // バックグラウンド時は停止
            try {
                const msgs = await getConversationMessages(selectedId);
                if (!cancelled) setMessages(msgs);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[SellerMessagesContainer:poll] Failed to fetch messages",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(
                        "[SellerMessagesContainer:poll] Unknown error",
                        error
                    );
                }
            }
        };

        // 選択時に相手発（購入者発）の未読を既読化（失敗しても表示は継続）
        const markRead = async () => {
            try {
                await markConversationRead(selectedId);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[SellerMessagesContainer:markRead] Failed to mark as read",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(
                        "[SellerMessagesContainer:markRead] Unknown error",
                        error
                    );
                }
            }
        };

        poll(); // 初回即時
        markRead();
        const id = setInterval(poll, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [selectedId]);

    // 送信成功後の即時再フェッチ（ポーリングを待たず反映）
    const handleSent = () => {
        if (!selectedId) return;
        let cancelled = false;
        (async () => {
            try {
                const msgs = await getConversationMessages(selectedId);
                if (!cancelled) setMessages(msgs);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[SellerMessagesContainer:handleSent] Failed to refetch",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(
                        "[SellerMessagesContainer:handleSent] Unknown error",
                        error
                    );
                }
            }
        })();
    };

    return (
        <div className="flex h-[520px] gap-3">
            {/* 左ペイン: 会話一覧（購入者で識別） */}
            <div className="w-[300px] shrink-0 overflow-y-auto rounded-md border">
                {conversations.length === 0 ? (
                    <div className="p-4 text-sm text-[#999]">
                        No conversations yet.
                    </div>
                ) : (
                    conversations.map((conv) => {
                        const latest = conv.messages[0];
                        return (
                            <button
                                key={conv.id}
                                type="button"
                                onClick={() => setSelectedId(conv.id)}
                                className={cn(
                                    "flex w-full items-center gap-2 border-b px-3 py-2 text-left hover:bg-[#f5f5f5]",
                                    {
                                        "bg-[#f5f5f5]": conv.id === selectedId,
                                    }
                                )}
                            >
                                {conv.user.picture && (
                                    <Image
                                        src={conv.user.picture}
                                        alt={conv.user.name}
                                        width={32}
                                        height={32}
                                        className="size-8 shrink-0 rounded-full object-cover"
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold">
                                        {conv.user.name}
                                    </div>
                                    <div className="truncate text-xs text-[#999]">
                                        {latest?.content ?? "No messages"}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* 右ペイン: スレッド（conversation-thread.tsx を流用） */}
            <div className="flex-1 rounded-md border">
                <ConversationThread
                    conversation={selected}
                    messages={messages}
                    onSent={handleSent}
                />
            </div>
        </div>
    );
}
