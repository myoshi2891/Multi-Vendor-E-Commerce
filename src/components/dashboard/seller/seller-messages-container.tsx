"use client";

import MessagesLayout from "@/components/shared/messages/messages-layout";
import { useConversationThread } from "@/components/shared/messages/use-conversation-thread";
import { StoreConversationWithLatest } from "@/lib/types";
import { useState } from "react";

/**
 * 販売者向けメッセージ画面のコンテナ（2ペイン: 会話一覧 + スレッド）。
 *
 * 購入者向け {@link MessagesContainer} と同型だが、左ペインは自店舗ではなく相手（購入者）の
 * name / picture で会話を識別する（販売者にとって店舗は常に自分のため）。ポーリング等の
 * ロジックは共通フック {@link useConversationThread}、2 ペイン骨格は {@link MessagesLayout}
 * を共有する。右ペインの {@link ConversationThread} はバブル振り分けを購入者発か否かのみで
 * 判定し閲覧者に依存しない（design.md §4.4 / 判断2）。
 *
 * @param props.initialConversations - サーバーで取得した会話一覧（updatedAt 降順）
 */
export default function SellerMessagesContainer({
    initialConversations,
}: Readonly<{
    initialConversations: StoreConversationWithLatest[];
}>) {
    const [conversations] =
        useState<StoreConversationWithLatest[]>(initialConversations);
    const { selectedId, messages, selectConversation, handleSent } =
        useConversationThread("SellerMessagesContainer");

    const selected = conversations.find((c) => c.id === selectedId) ?? null;

    return (
        <MessagesLayout
            conversations={conversations}
            selected={selected}
            selectedId={selectedId}
            getAvatar={(conv) => ({
                src: conv.user.picture,
                name: conv.user.name,
            })}
            messages={messages}
            onSelect={selectConversation}
            onSent={handleSent}
        />
    );
}
