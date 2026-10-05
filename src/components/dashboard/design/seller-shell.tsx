"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./seller.module.css";

export default function SellerShell({
    sidebar,
    header,
    children,
}: {
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
                    aria-label="Store navigation"
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
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        setOpen(false);
                        trigger.current?.focus();
                    }
                }}
                onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a"))
                        setOpen(false);
                }}
            >
                {sidebar}
            </aside>
            <main className={styles.main}>{children}</main>
        </div>
    );
}
