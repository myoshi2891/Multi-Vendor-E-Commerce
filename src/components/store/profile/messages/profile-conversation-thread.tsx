"use client";
import type {
    ProfileConversation,
    ProfileMessage,
    ProfileMessageActions,
} from "@/lib/profile-messages";
import { SendMessageSchema } from "@/lib/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import styles from "./messages.module.css";
const ComposerSchema = SendMessageSchema.pick({ content: true });
export default function ProfileConversationThread({
    conversation,
    messages,
    loading,
    error,
    onRetry,
    sendMessageAction,
    onSent,
    onBusyChange,
    counterpartyName,
    viewer = "buyer",
}: {
    counterpartyName?: string;
    viewer?: "buyer" | "seller";
    conversation: ProfileConversation;
    messages: ProfileMessage[];
    loading: boolean;
    error: boolean;
    onRetry: () => void;
    sendMessageAction: ProfileMessageActions["sendMessageAction"];
    onSent: () => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const form = useForm<z.infer<typeof ComposerSchema>>({
        resolver: zodResolver(ComposerSchema),
        defaultValues: { content: "" },
    });
    const inFlight = useRef(false);
    const [sendError, setSendError] = useState(false);
    const [sent, setSent] = useState(false);
    const pending = form.formState.isSubmitting;
    const submit = form.handleSubmit(async (values) => {
        setSendError(false);
        setSent(false);
        try {
            await sendMessageAction(conversation.id, values.content);
            form.reset({ content: "" });
            setSent(true);
            onSent();
        } catch {
            setSendError(true);
        }
    });
    return (
        <section className={styles.thread} aria-label="Selected conversation">
            <header className={styles.threadHeading}>
                <p className={styles.eyebrow}>YOUR CONVERSATION</p>
                <h2>{counterpartyName ?? conversation.store.name}</h2>
            </header>
            <div
                className={styles.log}
                role="log"
                aria-label="Conversation messages"
                tabIndex={0}
                aria-busy={loading}
            >
                {loading ? (
                    <div role="status" className={styles.message}>
                        <p>Loading messages…</p>
                        <div className={styles.skeleton} aria-hidden="true" />
                    </div>
                ) : error ? (
                    <div role="alert" className={styles.message}>
                        <p>
                            We couldn’t load these messages. Please try again.
                        </p>
                        <button
                            type="button"
                            className={styles.secondary}
                            onClick={onRetry}
                        >
                            Retry messages
                        </button>
                    </div>
                ) : messages.length === 0 ? (
                    <p className={styles.message}>
                        No messages yet. Say hello!
                    </p>
                ) : (
                    messages.map((message) => {
                        const buyer = message.senderId === conversation.userId;
                        return (
                            <div
                                key={message.id}
                                className={
                                    buyer ? styles.buyerRow : styles.storeRow
                                }
                            >
                                <div
                                    className={
                                        buyer
                                            ? styles.buyerBubble
                                            : styles.storeBubble
                                    }
                                >
                                    <p className={styles.sender}>
                                        {buyer
                                            ? viewer === "buyer"
                                                ? "You"
                                                : "Buyer"
                                            : viewer === "seller"
                                              ? "You"
                                              : "Store"}
                                    </p>
                                    <p className={styles.content}>
                                        {message.content}
                                    </p>
                                    <time
                                        dateTime={new Date(
                                            message.createdAt
                                        ).toISOString()}
                                    >
                                        {new Date(
                                            message.createdAt
                                        ).toLocaleString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            timeZone: "UTC",
                                        })}{" "}
                                        UTC
                                    </time>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            <form
                aria-label="Send a message"
                className={styles.composer}
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    if (inFlight.current || loading || error) return;
                    inFlight.current = true;
                    onBusyChange(true);
                    void submit(event).finally(() => {
                        inFlight.current = false;
                        onBusyChange(false);
                    });
                }}
            >
                <label htmlFor="message-content">Your message</label>
                <p id="message-help" className={styles.help}>
                    Up to 2,000 characters.
                </p>
                <textarea
                    id="message-content"
                    placeholder="Type a message..."
                    {...form.register("content")}
                    disabled={pending || loading || error}
                    aria-invalid={Boolean(form.formState.errors.content)}
                    aria-describedby={`message-help${form.formState.errors.content ? " message-error" : ""}`}
                />
                {form.formState.errors.content && (
                    <p id="message-error" role="alert" className={styles.error}>
                        {form.formState.errors.content.message}
                    </p>
                )}
                {sendError && (
                    <p role="alert" className={styles.error}>
                        We couldn’t send your message. Your draft is saved.
                        Please try again.
                    </p>
                )}
                {sent && (
                    <p role="status" className={styles.help}>
                        Message sent.
                    </p>
                )}
                {pending && (
                    <p role="status" className={styles.help}>
                        Sending message…
                    </p>
                )}
                <button
                    type="submit"
                    className={styles.primary}
                    disabled={pending || loading || error}
                >
                    {pending ? "Sending…" : "Send"}
                </button>
            </form>
        </section>
    );
}
