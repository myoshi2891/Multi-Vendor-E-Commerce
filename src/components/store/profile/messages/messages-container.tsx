"use client";

import MessagesLayout from "@/components/shared/messages/messages-layout";
import { useConversationThread } from "@/components/shared/messages/use-conversation-thread";
import { ConversationWithLatest } from "@/lib/types";
import { useState } from "react";

/**
 * 購入者向けメッセージ画面のコンテナ（2ペイン: 会話一覧 + スレッド）。
 *
 * 会話一覧は相手＝店舗（logo / name）で識別する。ポーリング・既読化・送信後再フェッチは
 * 共通フック {@link useConversationThread} に、2 ペイン骨格は {@link MessagesLayout} に
 * 集約しており、販売者向け SellerMessagesContainer とロジックを共有する。
 *
 * @param props.initialConversations - サーバーで取得した会話一覧（updatedAt 降順）
 */
export default function MessagesContainer({
    initialConversations,
}: Readonly<{
    initialConversations: ConversationWithLatest[];
}>) {
    const [conversations] =
        useState<ConversationWithLatest[]>(initialConversations);
    const { selectedId, messages, selectConversation, handleSent } =
        useConversationThread("MessagesContainer");

    const selected = conversations.find((c) => c.id === selectedId) ?? null;

    return (
        <MessagesLayout
            conversations={conversations}
            selected={selected}
            selectedId={selectedId}
            getAvatar={(conv) => ({
                src: conv.store.logo,
                name: conv.store.name,
            })}
            messages={messages}
            onSelect={selectConversation}
            onSent={handleSent}
        />
    );
}
