"use client";

import { useRef, useState } from "react";
import { useResultsFocusRestore } from "./use-results-focus-restore";

export type HistoryCriteria<F extends string, P extends string> = {
    filter: F | "";
    period: P | "";
    search: string;
    page: number;
};

/**
 * Shared loader state for the profile order/payment history tables.
 *
 * `load()` ignores calls while a request is in flight, keeps the previous
 * results on failure (exposing `error` for a retry), and restores keyboard
 * focus to the results region via `useResultsFocusRestore`.
 */
export function useHistoryResults<F extends string, P extends string, R>({
    initialData,
    initialFilter,
    initialError = false,
    fetchPage,
}: {
    initialData: R;
    initialFilter: F | "";
    initialError?: boolean;
    fetchPage: (
        filter: F | "",
        period: P | "",
        search: string,
        page: number
    ) => Promise<R>;
}) {
    const [data, setData] = useState<R>(initialData);
    const [criteria, setCriteria] = useState<HistoryCriteria<F, P>>({
        filter: initialFilter,
        period: "",
        search: "",
        page: 1,
    });
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(initialError);
    const inFlight = useRef(false);
    const { sectionRef, resultsRef, markFocus } =
        useResultsFocusRestore(pending);
    async function load(next: HistoryCriteria<F, P>) {
        if (inFlight.current) return;
        inFlight.current = true;
        markFocus();
        setCriteria(next);
        setPending(true);
        setError(false);
        try {
            setData(
                await fetchPage(
                    next.filter,
                    next.period,
                    next.search,
                    next.page
                )
            );
        } catch {
            setError(true);
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    }
    return { data, criteria, pending, error, load, sectionRef, resultsRef };
}
