"use client";

import { MessageType } from "@/lib/types";
import {
    getConversationMessages,
    markConversationRead,
} from "@/queries/message";
import { useEffect, useRef, useState } from "react";

// ポーリング間隔（NFR-M5・design.md 判断4）
const POLL_INTERVAL_MS = 5000;

/**
 * Manages the currently selected conversation, its messages, and message synchronization.
 *
 * Maintains the active conversation selection and automatically fetches its messages at regular intervals.
 * When a conversation is selected, messages are cleared immediately to prevent showing the previous conversation's content.
 * The conversation is marked as read when selected. After a message is sent, new messages are fetched immediately rather than waiting for the next polling cycle.
 *
 * @param logLabel - A prefix for structured error logs to identify the calling component.
 * @returns An object containing the selected conversation ID, its messages, a function to switch conversations, and a function to refetch messages after sending.
 */
export function useConversationThread(logLabel: string) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<MessageType[]>([]);
    // 非同期フェッチ完了時に「現在選択中の会話」と照合するための live 参照
    const selectedIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedId) return; // 未選択時は初期値 [] のまま
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
                        `[${logLabel}:poll] Failed to fetch messages`,
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(`[${logLabel}:poll] Unknown error`, error);
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
                        `[${logLabel}:markRead] Failed to mark as read`,
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(`[${logLabel}:markRead] Unknown error`, error);
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
    }, [selectedId, logLabel]);

    /** 会話を切り替える（同一なら no-op / 切替時は前会話のバブルを即クリア）。 */
    const selectConversation = (id: string) => {
        if (id === selectedId) return;
        setMessages([]);
        setSelectedId(id);
    };

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
                        `[${logLabel}:handleSent] Failed to refetch`,
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(`[${logLabel}:handleSent] Unknown error`, error);
                }
            }
        })();
    };

    return { selectedId, messages, selectConversation, handleSent };
}
