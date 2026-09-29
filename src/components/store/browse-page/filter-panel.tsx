"use client";

import { ReactNode, useId, useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import styles from "./filter-panel.module.css";

export default function FilterPanel({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const panelId = useId();

    return (
        <div className={styles.panel}>
            <button
                type="button"
                className={styles.toggle}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((value) => !value)}
            >
                <SlidersHorizontal size={16} aria-hidden="true" />
                {open ? "Hide filters" : "Show filters"}
                <ChevronDown size={16} aria-hidden="true" />
            </button>
            <div id={panelId} className={styles.content} data-open={open}>
                {children}
            </div>
        </div>
    );
}
