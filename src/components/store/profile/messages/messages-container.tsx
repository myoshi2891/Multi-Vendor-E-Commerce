"use client";
import type {
    ProfileConversation,
    ProfileMessageActions,
} from "@/lib/profile-messages";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import MessagesHeading from "./messages-heading";
import ProfileConversationThread from "./profile-conversation-thread";
import { useProfileConversation } from "./use-profile-conversation";
import styles from "./messages.module.css";
export default function MessagesContainer({
    initialConversations,
    initialError = false,
    ...actions
}: {
    initialConversations: ProfileConversation[];
    initialError?: boolean;
} & ProfileMessageActions) {
    const [conversations, setConversations] = useState(initialConversations);
    const [loadError, setLoadError] = useState(initialError);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const loadingRef = useRef(false);
    const thread = useProfileConversation(actions);
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
        <section
            className={styles.messages}
            data-messages
            aria-label="Message management"
        >
            <MessagesHeading />
            <div className={styles.toolbar}>
                <p>Conversations with your stores.</p>
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
                        We couldn’t load your conversations. Please try again.
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
                        <p>Your conversations with stores will appear here.</p>
                        <Link href="/browse" className={styles.primary}>
                            Explore the collection
                        </Link>
                    </div>
                )
            ) : (
                <div className={styles.layout}>
                    <nav
                        aria-label="Store conversations"
                        tabIndex={0}
                        className={styles.list}
                    >
                        {conversations.map((conversation) => (
                            <button
                                type="button"
                                key={conversation.id}
                                className={styles.conversation}
                                aria-label={`Open conversation with ${conversation.store.name}`}
                                aria-pressed={
                                    thread.selectedId === conversation.id
                                }
                                disabled={sending || loading}
                                onClick={() =>
                                    thread.selectConversation(conversation.id)
                                }
                            >
                                {conversation.store.logo && (
                                    <Image
                                        src={conversation.store.logo}
                                        alt=""
                                        width={36}
                                        height={36}
                                    />
                                )}
                                <span>
                                    <strong>{conversation.store.name}</strong>
                                    <span className={styles.preview}>
                                        {conversation.messages[0]?.content ??
                                            "No messages"}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </nav>
                    <div className={styles.threadPane}>
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
                                messages={thread.messages}
                                loading={thread.loading}
                                error={thread.error}
                                onRetry={thread.retry}
                                sendMessageAction={actions.sendMessageAction}
                                onSent={thread.onSent}
                                onBusyChange={setSending}
                            />
                        ) : (
                            <div className={styles.empty}>
                                <h2>A little conversation</h2>
                                <p>Select a conversation to view messages.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
