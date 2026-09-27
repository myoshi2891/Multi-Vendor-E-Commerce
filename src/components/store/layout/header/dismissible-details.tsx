"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native disclosure with touch, keyboard, outside-click and navigation dismissal. */
export default function DismissibleDetails({
    children,
    className,
}: Readonly<{ children: ReactNode; className?: string }>) {
    const ref = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        const details = ref.current;
        if (!details) return;
        const close = () => {
            details.open = false;
        };
        const dismiss = (event: PointerEvent) => {
            if (event.target instanceof Node && !details.contains(event.target))
                close();
        };
        // 入れ子時は最も内側の開いている disclosure だけを閉じる。リスナー順に
        // 依存しないよう、処理済み (defaultPrevented) と開いた子孫の両方で譲る。
        const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || !details.open) return;
            if (event.defaultPrevented) return;
            if (details.querySelector("details[open]")) return;
            event.preventDefault();
            close();
            details.querySelector("summary")?.focus();
        };
        // パネル内リンクでの遷移を委譲で拾う。JSX の onClick は非インタラクティブ要素
        // (<details>) へのハンドラになるため、ネイティブリスナーで登録する。
        const navigate = (event: MouseEvent) => {
            if (
                event.target instanceof Element &&
                event.target.closest("a[href]")
            )
                close();
        };
        document.addEventListener("pointerdown", dismiss);
        document.addEventListener("keydown", escape);
        details.addEventListener("click", navigate);
        details.addEventListener("submit", close);
        return () => {
            document.removeEventListener("pointerdown", dismiss);
            document.removeEventListener("keydown", escape);
            details.removeEventListener("click", navigate);
            details.removeEventListener("submit", close);
        };
    }, []);
    return (
        <details ref={ref} className={className}>
            {children}
        </details>
    );
}
