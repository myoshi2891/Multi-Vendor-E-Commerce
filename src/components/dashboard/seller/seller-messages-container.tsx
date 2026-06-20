"use client";

import MessagesLayout from "@/components/shared/messages/messages-layout";
import { useConversationThread } from "@/components/shared/messages/use-conversation-thread";
import { StoreConversationWithLatest } from "@/lib/types";
import { useState } from "react";

/**
 * Two-pane messaging interface for sellers to view and respond to conversations with buyers.
 *
 * Displays a list of conversations in the left pane and the selected conversation's thread in the right pane. Manages conversation selection and message polling via shared hooks.
 *
 * @param props.initialConversations - Conversation list retrieved from the server, sorted by `updatedAt` in descending order
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
