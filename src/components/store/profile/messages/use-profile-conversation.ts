"use client";
import { useEffect, useRef, useState } from "react";
import type {
    ProfileMessage,
    ProfileMessageActions,
} from "@/lib/profile-messages";

/** Conversation polling with injected actions, cancellation and visible retry states. */
export function useProfileConversation(
    actions: Pick<
        ProfileMessageActions,
        "loadMessagesAction" | "markReadAction"
    >
) {
    const { loadMessagesAction, markReadAction } = actions;
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const liveId = useRef<string | null>(null);
    const [messages, setMessages] = useState<ProfileMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [readError, setReadError] = useState(false);
    const [reading, setReading] = useState(false);
    const refresh = useRef<(foreground?: boolean) => void>(() => {});
    const retryRead = useRef<() => void>(() => {});
    useEffect(() => {
        if (!selectedId) return;
        const id = selectedId;
        let cancelled = false;
        let inFlight = false;
        let queued = false;
        let marking = false;
        const active = () => !cancelled && liveId.current === id;
        async function load(foreground = false) {
            if (inFlight) {
                if (foreground) queued = true;
                return;
            }
            if (!active()) return;
            inFlight = true;
            if (foreground) {
                setLoading(true);
                setError(false);
            }
            try {
                const next = await loadMessagesAction(id);
                if (active()) {
                    setMessages(next);
                    setError(false);
                }
            } catch {
                if (active()) setError(true);
            } finally {
                inFlight = false;
                if (active()) {
                    setLoading(false);
                    if (queued) {
                        queued = false;
                        void load(true);
                    }
                }
            }
        }
        async function markRead() {
            if (marking || !active()) return;
            marking = true;
            setReading(true);
            try {
                await markReadAction(id);
                if (active()) setReadError(false);
            } catch {
                if (active()) setReadError(true);
            } finally {
                marking = false;
                if (active()) setReading(false);
            }
        }
        refresh.current = (foreground) => {
            void load(foreground);
        };
        retryRead.current = () => {
            void markRead();
        };
        void load(true);
        void markRead();
        const timer = setInterval(() => {
            if (!document.hidden) void load(false);
        }, 5000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [selectedId, loadMessagesAction, markReadAction]);
    function selectConversation(id: string | null) {
        if (liveId.current === id) return;
        liveId.current = id;
        setMessages([]);
        setError(false);
        setReadError(false);
        setReading(false);
        setLoading(Boolean(id));
        setSelectedId(id);
    }
    return {
        selectedId,
        messages,
        loading,
        error,
        readError,
        reading,
        selectConversation,
        retry: () => refresh.current(true),
        onSent: () => refresh.current(true),
        retryRead: () => retryRead.current(),
    };
}
