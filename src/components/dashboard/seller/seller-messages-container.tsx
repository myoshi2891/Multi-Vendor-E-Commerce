"use client";
import type {
    SellerConversation,
    SellerMessageActions,
} from "@/lib/seller-messages";
import Image from "next/image";
import { useCallback, useId, useRef, useState } from "react";
import SellerPage from "../design/seller-page";
import ProfileConversationThread from "@/components/store/profile/messages/profile-conversation-thread";
import { useProfileConversation } from "@/components/store/profile/messages/use-profile-conversation";
import styles from "@/components/store/profile/messages/messages.module.css";
export default function SellerMessagesContainer({
    initialConversations,
    initialError = false,
    ...actions
}: {
    initialConversations: SellerConversation[];
    initialError?: boolean;
} & SellerMessageActions) {
    const unreadId = useId();
    const selectedTrigger = useRef<HTMLButtonElement | null>(null);
    const threadPane = useRef<HTMLDivElement>(null);
    const [conversations, setConversations] = useState(initialConversations);
    const [loadError, setLoadError] = useState(initialError);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const loadingRef = useRef(false);
    const markReadAction = actions.markReadAction;
    const markRead = useCallback(
        async (id: string) => {
            const result = await markReadAction(id);
            setConversations((current) =>
                current.map((conversation) =>
                    conversation.id === id
                        ? { ...conversation, unreadLatest: false }
                        : conversation
                )
            );
            return result;
        },
        [markReadAction]
    );
    const thread = useProfileConversation({
        ...actions,
        markReadAction: markRead,
    });
    const selected = conversations.find(
        (item) => item.id === thread.selectedId
    );
    async function reload() {
        if (loadingRef.current || sending) return;
        loadingRef.current = true;
        setLoading(true);
        setLoadError(false);
        try {
            const next = await actions.loadConversationsAction();
            setConversations(next);
            if (
                thread.selectedId &&
                !next.some((item) => item.id === thread.selectedId)
            )
                thread.selectConversation(null);
        } catch {
            setLoadError(true);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }
    return (
        <SellerPage
            id="store-messages"
            title="Messages"
            description="Conversations with your customers."
        >
            <section
                className={`${styles.messages} ${styles.seller}`}
                data-messages
                aria-label="Message management"
            >
                <div className={styles.toolbar}>
                    <p>Keep in touch with your customers.</p>
                    <button
                        type="button"
                        className={styles.secondary}
                        disabled={loading || sending}
                        onClick={() => void reload()}
                    >
                        Refresh conversations
                    </button>
                </div>
                {loading && (
                    <p role="status" className={styles.message}>
                        Loading conversations…
                    </p>
                )}
                {loadError && (
                    <div role="alert" className={styles.notice}>
                        <p>
                            We couldn’t load your conversations. Please try
                            again.
                        </p>
                        <button
                            type="button"
                            className={styles.secondary}
                            disabled={sending}
                            onClick={() => void reload()}
                        >
                            Try again
                        </button>
                    </div>
                )}
                {conversations.length === 0 ? (
                    !loadError &&
                    !loading && (
                        <div className={styles.empty}>
                            <span aria-hidden="true">◇</span>
                            <h2>No conversations yet</h2>
                            <p>Your customer conversations will appear here.</p>
                        </div>
                    )
                ) : (
                    <div
                        className={styles.layout}
                        data-selected={Boolean(selected)}
                    >
                        <nav
                            aria-label="Customer conversations"
                            tabIndex={0}
                            className={styles.list}
                        >
                            {conversations.map((conversation) => (
                                <button
                                    type="button"
                                    key={conversation.id}
                                    className={styles.conversation}
                                    aria-label={`Open conversation with ${conversation.user.name}`}
                                    aria-describedby={conversation.unreadLatest ? `${unreadId}-${conversation.id}` : undefined}
                                    aria-pressed={
                                        thread.selectedId === conversation.id
                                    }
                                    disabled={sending || loading}
                                    onClick={(event) => {
                                        selectedTrigger.current =
                                            event.currentTarget;
                                        thread.selectConversation(
                                            conversation.id
                                        );
                                        requestAnimationFrame(() =>
                                            threadPane.current?.focus()
                                        );
                                    }}
                                >
                                    {conversation.user.picture && (
                                        <Image
                                            src={conversation.user.picture}
                                            alt={conversation.user.name}
                                            width={36}
                                            height={36}
                                        />
                                    )}
                                    <span>
                                        <strong>
                                            {conversation.user.name}
                                        </strong>
                                        {conversation.unreadLatest && (
                                            <span id={`${unreadId}-${conversation.id}`} className={styles.unread}>Unread</span>
                                        )}
                                        <span className={styles.preview}>
                                            {conversation.messages[0]
                                                ?.content ?? "No messages"}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </nav>
                        <div
                            className={styles.threadPane}
                            ref={threadPane}
                            tabIndex={-1}
                        >
                            {selected && (
                                <button
                                    type="button"
                                    className={styles.back}
                                    disabled={sending}
                                    onClick={() => {
                                        thread.selectConversation(null);
                                        requestAnimationFrame(() =>
                                            selectedTrigger.current?.focus()
                                        );
                                    }}
                                >
                                    Back to conversations
                                </button>
                            )}
                            {thread.readError && (
                                <div className={styles.notice} role="alert">
                                    <p>
                                        We couldn’t update the read status. Your
                                        messages are available.
                                    </p>
                                    <button
                                        type="button"
                                        className={styles.secondary}
                                        disabled={thread.reading || sending}
                                        onClick={thread.retryRead}
                                    >
                                        Retry read status
                                    </button>
                                </div>
                            )}
                            {selected ? (
                                <ProfileConversationThread
                                    key={selected.id}
                                    conversation={selected}
                                    counterpartyName={selected.user.name}
                                    viewer="seller"
                                    messages={thread.messages}
                                    loading={thread.loading}
                                    error={thread.error}
                                    onRetry={thread.retry}
                                    sendMessageAction={
                                        actions.sendMessageAction
                                    }
                                    onSent={thread.onSent}
                                    onBusyChange={setSending}
                                />
                            ) : (
                                <div className={styles.empty}>
                                    <h2>A little conversation</h2>
                                    <p>
                                        Select a conversation to view messages.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>
        </SellerPage>
    );
}
