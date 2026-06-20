"use client";

import { ConversationWithLatest, MessageType } from "@/lib/types";
import {
    getConversationMessages,
    markConversationRead,
} from "@/queries/message";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ConversationThread from "./conversation-thread";

// ポーリング間隔（NFR-M5・design.md 判断4）
const POLL_INTERVAL_MS = 5000;

/**
 * 購入者向けメッセージ画面のコンテナ（2ペイン: 会話一覧 + スレッド）。
 *
 * 左ペインで会話を選択すると、右ペインに {@link ConversationThread} を描画し、
 * 選択中の会話のメッセージを 5 秒間隔でポーリングする（design.md §4.2）。
 * ポーリングは tech.md の cancelled パターンでアンマウント/再選択時のレースを防ぎ、
 * `document.hidden`（タブ背面化）時は停止して負荷を抑える。
 *
 * 会話選択・送信成功時には相手発の未読を既読化する（markConversationRead）。
 *
 * @param props.initialConversations - サーバーで取得した会話一覧（updatedAt 降順）
 */
export default function MessagesContainer({
    initialConversations,
}: {
    initialConversations: ConversationWithLatest[];
}) {
    const [conversations] =
        useState<ConversationWithLatest[]>(initialConversations);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<MessageType[]>([]);
    // 非同期フェッチ完了時に「現在選択中の会話」と照合するための live 参照
    const selectedIdRef = useRef<string | null>(null);

    const selected = conversations.find((c) => c.id === selectedId) ?? null;

    useEffect(() => {
        if (!selectedId) return; // 未選択時は初期値 [] のまま（deselect 遷移は存在しない）
        selectedIdRef.current = selectedId;
        let cancelled = false;
        let inFlight = false; // 多重ポーリング防止（遅延レスポンスの順序逆転を防ぐ）

        const poll = async () => {
            if (document.hidden || inFlight) return; // 背面化中 or 実行中はスキップ
            inFlight = true;
            try {
                const msgs = await getConversationMessages(selectedId);
                if (!cancelled) setMessages(msgs);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[MessagesContainer:poll] Failed to fetch messages",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(
                        "[MessagesContainer:poll] Unknown error",
                        error
                    );
                }
            } finally {
                inFlight = false;
            }
        };

        // 選択時に相手発の未読を既読化（失敗しても表示は継続）
        const markRead = async () => {
            try {
                await markConversationRead(selectedId);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[MessagesContainer:markRead] Failed to mark as read",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(
                        "[MessagesContainer:markRead] Unknown error",
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
        const requestedId = selectedId; // 起動時点の会話 ID を捕捉
        void (async () => {
            try {
                const msgs = await getConversationMessages(requestedId);
                // フェッチ中に別会話へ切り替わっていたら破棄（取り違え防止）
                if (requestedId === selectedIdRef.current) setMessages(msgs);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[MessagesContainer:handleSent] Failed to refetch",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(
                        "[MessagesContainer:handleSent] Unknown error",
                        error
                    );
                }
            }
        })();
    };

    return (
        <div className="flex h-[520px] gap-3">
            {/* 左ペイン: 会話一覧 */}
            <div className="w-[300px] shrink-0 overflow-y-auto rounded-md border">
                {conversations.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">
                        No conversations yet.
                    </div>
                ) : (
                    conversations.map((conv) => {
                        const latest = conv.messages[0];
                        return (
                            <button
                                key={conv.id}
                                type="button"
                                onClick={() => {
                                    if (conv.id === selectedId) return;
                                    // 会話切替時に前会話のバブルが残らないよう即座にクリア
                                    setMessages([]);
                                    setSelectedId(conv.id);
                                }}
                                className={cn(
                                    "flex w-full items-center gap-2 border-b px-3 py-2 text-left hover:bg-slate-100",
                                    {
                                        "bg-slate-100": conv.id === selectedId,
                                    }
                                )}
                            >
                                {conv.store.logo && (
                                    <Image
                                        src={conv.store.logo}
                                        alt={conv.store.name}
                                        width={32}
                                        height={32}
                                        className="size-8 shrink-0 rounded-full object-cover"
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold">
                                        {conv.store.name}
                                    </div>
                                    <div className="truncate text-xs text-slate-500">
                                        {latest?.content ?? "No messages"}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* 右ペイン: スレッド */}
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
