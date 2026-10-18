"use client";

import { useEffect, useRef } from "react";

/**
 * Restores keyboard focus to a results region after an async reload.
 *
 * Pager/retry controls unmount while loading, which drops focus to <body>.
 * Call `markFocus()` before starting the load; once `pending` turns false,
 * focus moves to `resultsRef` only if focus was inside `sectionRef` and the
 * user has not moved to another control meanwhile.
 */
export function useResultsFocusRestore(pending: boolean) {
    const sectionRef = useRef<HTMLElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const restoreFocus = useRef(false);
    useEffect(() => {
        if (pending || !restoreFocus.current) return;
        restoreFocus.current = false;
        if (document.activeElement === document.body)
            resultsRef.current?.focus();
    }, [pending]);
    function markFocus() {
        restoreFocus.current = Boolean(
            sectionRef.current?.contains(document.activeElement)
        );
    }
    return { sectionRef, resultsRef, markFocus };
}
