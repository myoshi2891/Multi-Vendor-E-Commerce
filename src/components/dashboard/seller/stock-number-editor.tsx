"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LowStockThresholdSchema } from "@/lib/schemas";
import styles from "../design/seller.module.css";

export default function StockNumberEditor({
    initialValue,
    label,
    saveAction,
    successText,
}: {
    initialValue: number;
    label: string;
    saveAction: (value: number) => Promise<unknown>;
    successText: string;
}) {
    const id = useId(),
        router = useRouter();
    const [value, setValue] = useState(String(initialValue)),
        [busy, setBusy] = useState(false),
        [feedback, setFeedback] = useState<
            "invalid" | "failed" | "saved" | null
        >(null);
    const [retryValue, setRetryValue] = useState<number | null>(null);
    const committed = useRef(initialValue),
        pending = useRef(false);
    const save = async (attempt?: number) => {
        if (pending.current) return;
        const parsed = attempt ?? Number(value.trim());
        if (
            (attempt === undefined && value.trim() === "") ||
            !LowStockThresholdSchema.shape.threshold.safeParse(parsed).success
        ) {
            setValue(String(committed.current));
            setFeedback("invalid");
            return;
        }
        if (parsed === committed.current) return;
        pending.current = true;
        setBusy(true);
        setFeedback(null);
        try {
            await saveAction(parsed);
            committed.current = parsed;
            setValue(String(parsed));
            setRetryValue(null);
            setFeedback("saved");
            router.refresh();
        } catch {
            setValue(String(committed.current));
            setRetryValue(parsed);
            setFeedback("failed");
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    return (
        <div role="group" aria-label={`${label}の編集`}>
            <div className="flex flex-wrap items-end gap-2">
                <div>
                    <label htmlFor={id} className="mb-1 block text-sm">
                        {label}
                    </label>
                    <Input
                        id={id}
                        type="number"
                        min={0}
                        max={1000000}
                        step={1}
                        value={value}
                        disabled={busy}
                        onChange={(event) => {
                            setValue(event.target.value);
                            setFeedback(null);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void save();
                            }
                        }}
                        className="h-9 w-28"
                    />
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void save()}
                >
                    {busy ? "保存中…" : "保存"}
                </Button>
            </div>
            {feedback === "invalid" && (
                <p role="alert" className={styles.alert}>
                    0〜1,000,000の整数を入力してください。
                </p>
            )}
            {feedback === "failed" && (
                <div role="alert" className={styles.alert}>
                    <p>更新に失敗しました。再試行してください。</p>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                            if (retryValue !== null) void save(retryValue);
                        }}
                    >
                        再試行
                    </Button>
                </div>
            )}
            {feedback === "saved" && (
                <p role="status" className="mt-2 text-sm">
                    {successText}
                </p>
            )}
        </div>
    );
}
