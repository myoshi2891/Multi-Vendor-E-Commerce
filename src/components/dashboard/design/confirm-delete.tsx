"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import styles from "./seller.module.css";
export default function ConfirmDelete({
    label,
    deleteAction,
}: {
    label: string;
    deleteAction: () => Promise<unknown>;
}) {
    const [open, setOpen] = useState(false),
        [busy, setBusy] = useState(false),
        [feedback, setFeedback] = useState<"failed" | "saved" | null>(null),
        pending = useRef(false),
        router = useRouter();
    async function remove() {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setFeedback(null);
        try {
            await deleteAction();
            setOpen(false);
            setFeedback("saved");
            router.refresh();
        } catch {
            setFeedback("failed");
        } finally {
            pending.current = false;
            setBusy(false);
        }
    }
    return (
        <div>
            <Dialog
                open={open}
                onOpenChange={(value) => {
                    if (!pending.current) {
                        setOpen(value);
                        setFeedback(null);
                    }
                }}
            >
                <DialogTrigger asChild>
                    <Button variant="outline">Delete {label}</Button>
                </DialogTrigger>
                <DialogContent
                    closeDisabled={busy}
                    className={`${styles.theme} ${styles.dialog}`}
                    onEscapeKeyDown={(e) => {
                        if (pending.current) e.preventDefault();
                    }}
                    onInteractOutside={(e) => {
                        if (pending.current) e.preventDefault();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Delete {label}?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. The {label} will be
                            deleted.
                        </DialogDescription>
                    </DialogHeader>
                    {feedback === "failed" && (
                        <p role="alert" className={styles.alert}>
                            Could not delete. Please try again.
                        </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={() => void remove()}
                        >
                            {busy
                                ? "Deleting…"
                                : feedback === "failed"
                                  ? "Retry delete"
                                  : "Confirm delete"}
                        </Button>
                    </div>
                    {busy && <p role="status">Deleting…</p>}
                </DialogContent>
            </Dialog>
            {feedback === "saved" && <p role="status">Deleted {label}.</p>}
        </div>
    );
}
