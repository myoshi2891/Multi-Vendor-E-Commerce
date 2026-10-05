"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./seller.module.css";

export default function SellerShell({
    sidebar,
    navigationLabel = "Store navigation",
    header,
    children,
}: {
    navigationLabel?: string;
    sidebar: ReactNode;
    header: ReactNode;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    return (
        <div className={`${styles.theme} ${styles.shell}`}>
            <div className={styles.topbar}>
                <button
                    ref={trigger}
                    type="button"
                    className={styles.navToggle}
                    aria-label={navigationLabel}
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() => setOpen(!open)}
                >
                    Menu <span aria-hidden="true">{open ? "−" : "+"}</span>
                </button>
                {header}
            </div>
            <aside
                id={id}
                className={styles.sidebar}
                data-open={open}
                // React の合成イベントはポータル配下からも DOM 外を経由して
                // バブルするため、aside の DOM 内で発生したイベントのみ扱う
                onKeyDown={(event) => {
                    if (!(event.target instanceof Node)) return;
                    if (!event.currentTarget.contains(event.target)) return;
                    if (event.key === "Escape") {
                        setOpen(false);
                        trigger.current?.focus();
                    }
                }}
                onClick={(event) => {
                    if (!(event.target instanceof Element)) return;
                    if (!event.currentTarget.contains(event.target)) return;
                    if (event.target.closest("a")) setOpen(false);
                }}
            >
                {sidebar}
            </aside>
            <main className={styles.main}>{children}</main>
        </div>
    );
}
