"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native disclosure with touch, keyboard, outside-click and navigation dismissal. */
export default function DismissibleDetails({ children, className }: { children: ReactNode; className?: string }) {
    const ref = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        const dismiss = (event: PointerEvent) => {
            if (event.target instanceof Node && !ref.current?.contains(event.target) && ref.current) ref.current.open = false;
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && ref.current?.open) {
                ref.current.open = false;
                ref.current.querySelector("summary")?.focus();
            }
        };
        document.addEventListener("pointerdown", dismiss);
        document.addEventListener("keydown", escape);
        return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
    }, []);
    return <details ref={ref} className={className} onClick={event => {
        if (event.target instanceof Element && event.target.closest("a[href]") && ref.current) ref.current.open = false;
    }} onSubmit={() => { if (ref.current) ref.current.open = false; }}>{children}</details>;
}
