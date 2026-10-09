"use client";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import styles from "../design/seller.module.css";
export default function MasterDialog<T>({
    label,
    className,
    loadAction,
    children,
}: {
    label: string;
    className?: string;
    loadAction?: () => Promise<T | null>;
    children: (
        data: T | undefined,
        onBusyChange: (busy: boolean) => void
    ) => ReactNode;
}) {
    const [open, setOpen] = useState(false),
        [data, setData] = useState<T>(),
        [loading, setLoading] = useState(false),
        [failed, setFailed] = useState(false),
        [busy, setBusy] = useState(false),
        generation = useRef(0),
        locked = useRef(false);
    async function load() {
        if (!loadAction) return;
        const request = ++generation.current;
        setLoading(true);
        setFailed(false);
        setData(undefined);
        try {
            const result = await loadAction();
            if (request !== generation.current) return;
            if (!result) throw Error("missing");
            setData(result);
        } catch {
            if (request === generation.current) setFailed(true);
        } finally {
            if (request === generation.current) setLoading(false);
        }
    }
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (locked.current) return;
                setOpen(value);
                if (value) {
                    if (loadAction) void load();
                } else {
                    generation.current++;
                    setData(undefined);
                    setFailed(false);
                }
            }}
        >
            <DialogTrigger asChild>
                <Button
                    className={className}
                    variant={loadAction ? "outline" : "default"}
                >
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent
                closeDisabled={busy}
                className={`${styles.theme} ${styles.dialog} ${className ?? ""}`}
                onEscapeKeyDown={(e) => {
                    if (locked.current) e.preventDefault();
                }}
                onInteractOutside={(e) => {
                    if (locked.current) e.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle>{label}</DialogTitle>
                    <DialogDescription>
                        Manage information and save your changes.
                    </DialogDescription>
                </DialogHeader>
                {loading ? (
                    <p role="status">Loading information…</p>
                ) : failed ? (
                    <div className={styles.alert}>
                        <p role="alert">
                            Could not load information. Please try again.
                        </p>
                        <Button variant="outline" onClick={() => void load()}>
                            Retry load
                        </Button>
                    </div>
                ) : (
                    (!loadAction || data) &&
                    children(data, (value) => {
                        locked.current = value;
                        setBusy(value);
                    })
                )}
            </DialogContent>
        </Dialog>
    );
}
