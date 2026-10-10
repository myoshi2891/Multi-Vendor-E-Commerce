"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import styles from "../design/seller.module.css";
export default function StatusEditor({
    label,
    initialStatus,
    options,
    saveAction,
}: {
    label: string;
    initialStatus: string;
    options: string[];
    saveAction: (value: string) => Promise<unknown>;
}) {
    const id = useId(),
        router = useRouter(),
        pending = useRef(false);
    const [value, setValue] = useState(initialStatus),
        [committed, setCommitted] = useState(initialStatus),
        [busy, setBusy] = useState(false),
        [feedback, setFeedback] = useState<"failed" | "saved" | null>(null),
        [seenInitial, setSeenInitial] = useState(initialStatus);
    // refresh で届いた値の取り込み。自分の保存は committed と一致するので成功表示を残し、
    // 他者による変更だけを反映する（key に status を含めて remount すると成功表示まで消える）
    if (initialStatus !== seenInitial) {
        setSeenInitial(initialStatus);
        if (initialStatus !== committed) {
            setValue(initialStatus);
            setCommitted(initialStatus);
            setFeedback(null);
        }
    }
    const save = async () => {
        if (pending.current || value === committed || !options.includes(value))
            return;
        pending.current = true;
        setBusy(true);
        setFeedback(null);
        try {
            await saveAction(value);
            setCommitted(value);
            setFeedback("saved");
            router.refresh();
        } catch {
            setFeedback("failed");
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    return (
        <div
            role="group"
            aria-label={`${label} editor`}
            className={`${styles.controls} min-w-48 space-y-2`}
        >
            <label htmlFor={id} className="block text-sm">
                {label}
            </label>
            <select
                id={id}
                value={value}
                disabled={busy}
                onChange={(e) => {
                    setValue(e.target.value);
                    setFeedback(null);
                }}
                className="w-full border p-2"
            >
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </option>
                ))}
            </select>
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || value === committed}
                onClick={() => void save()}
            >
                {busy
                    ? "Saving…"
                    : feedback === "failed"
                      ? "Retry"
                      : "Save status"}
            </Button>
            {feedback === "failed" && (
                <p role="alert" className={styles.alert}>
                    Could not update status. Please try again.
                </p>
            )}
            {feedback === "saved" && (
                <p role="status" className={`${styles.success} text-sm`}>
                    Status updated.
                </p>
            )}
        </div>
    );
}
