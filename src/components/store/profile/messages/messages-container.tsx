"use client";

import MessagesLayout from "@/components/shared/messages/messages-layout";
import { useConversationThread } from "@/components/shared/messages/use-conversation-thread";
import { ConversationWithLatest } from "@/lib/types";
import { useState } from "react";

/**
 * Displays a two-pane messaging interface for buyers to view and manage conversations with stores.
 *
 * @param props.initialConversations - List of buyer conversations, ordered by most recent update
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
