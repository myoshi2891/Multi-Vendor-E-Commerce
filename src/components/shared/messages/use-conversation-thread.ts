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
 * 会話スレッドのポーリング・既読化・送信後再フェッチを集約するフック。
 *
 * 購入者向け {@link MessagesContainer} と販売者向け SellerMessagesContainer は
 * 表示する相手（店舗 / 購入者）のみ異なり、選択中会話のメッセージ取得ロジックは同一。
 * 重複（SonarCloud Duplications）を解消するため共通化した。
 *
 * 挙動:
 * - `selectConversation` で会話を切り替えると、前会話のバブルが残らないよう即座に
 *   messages をクリアしてから選択する（旧 MessagesContainer の優れた実装に統一）。
 * - 選択中は 5 秒間隔でポーリングし、`document.hidden`（タブ背面化）時は停止する。
 * - `inFlight` ガードで多重ポーリング（遅延レスポンスの順序逆転）を防ぐ。
 * - tech.md の cancelled パターンでアンマウント/再選択時のレースを防ぐ。
 * - `handleSent` は `selectedIdRef`（live 参照）で、フェッチ中に別会話へ切り替わった
 *   場合の取り違えを防ぐ。
 *
 * @param logLabel - 構造化ログのプレフィックス（例: "MessagesContainer"）。
 *                   呼び出し元コンテナごとにログ出所を区別するため引数化する。
 * @returns selectedId / messages / selectConversation / handleSent
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
