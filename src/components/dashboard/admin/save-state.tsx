"use client";
import { useRef, useState } from "react";
import styles from "../design/seller.module.css";
export function useSaveState(onBusyChange?: (busy: boolean) => void) {
    const pending = useRef(false),
        [busy, setBusy] = useState(false),
        [feedback, setFeedback] = useState<"failed" | "saved" | null>(null);
    async function save(action: () => Promise<unknown>, success: () => void) {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        onBusyChange?.(true);
        setFeedback(null);
        try {
            const result = await action();
            if (result == null) throw Error("missing save result");
            setFeedback("saved");
            success();
        } catch {
            setFeedback("failed");
        } finally {
            pending.current = false;
            setBusy(false);
            onBusyChange?.(false);
        }
    }
    return { busy, feedback, save };
}
export function SaveFeedback({
    busy,
    feedback,
}: {
    busy: boolean;
    feedback: "failed" | "saved" | null;
}) {
    return (
        <>
            {busy && <p role="status">Saving…</p>}
            {feedback === "failed" && (
                <p role="alert" className={styles.alert}>
                    Could not save. Your input has been kept. Please try again.
                </p>
            )}
            {feedback === "saved" && <p role="status">Changes saved.</p>}
        </>
    );
}
