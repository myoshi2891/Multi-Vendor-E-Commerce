"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductType } from "@/lib/types";
import ProductList from "../../shared/product-list";
import { DiscoveryPagination } from "../shared/discovery";
import styles from "../shared/discovery.module.css";

export type HistoryAction = (
    ids: string[],
    page: number
) => Promise<{ products: ProductType[]; totalPages: number }>;
type State = {
    status: "loading" | "error" | "ready";
    products: ProductType[];
    page: number;
    totalPages: number;
};

/** Read browser history after hydration; server action arrives through the route's Props. */
export default function HistoryContainer({
    page,
    fetchHistoryAction,
}: {
    page: number;
    fetchHistoryAction: HistoryAction;
}) {
    const router = useRouter();
    const [retry, setRetry] = useState(0);
    const [state, setState] = useState<State>({
        status: "loading",
        products: [],
        page,
        totalPages: 0,
    });
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setState({ status: "loading", products: [], page, totalPages: 0 });
            try {
                const raw = localStorage.getItem("productHistory");
                let parsed: unknown = [];
                // Malformed saved data is an empty history, distinct from unavailable storage.
                try {
                    parsed = raw ? JSON.parse(raw) : [];
                } catch {
                    parsed = [];
                }
                const ids =
                    Array.isArray(parsed) &&
                    parsed.every((id): id is string => typeof id === "string")
                        ? parsed
                        : [];
                if (!ids.length) {
                    if (!cancelled)
                        setState({
                            status: "ready",
                            products: [],
                            page: 1,
                            totalPages: 0,
                        });
                    return;
                }
                const result = await fetchHistoryAction(ids, page);
                if (cancelled) return;
                const canonicalPage =
                    result.totalPages >= 1
                        ? Math.min(page, result.totalPages)
                        : 1;
                const final =
                    canonicalPage === page
                        ? result
                        : await fetchHistoryAction(ids, canonicalPage);
                if (cancelled) return;
                setState({
                    status: "ready",
                    products: final.products,
                    page: canonicalPage,
                    totalPages: final.totalPages,
                });
                if (canonicalPage !== page)
                    router.replace(`/profile/history/${canonicalPage}`);
            } catch {
                if (!cancelled)
                    setState({
                        status: "error",
                        products: [],
                        page,
                        totalPages: 0,
                    });
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [page, fetchHistoryAction, retry, router]);
    if (state.status === "loading")
        return (
            <p role="status" className={styles.loading}>
                Loading recently viewed pieces…
            </p>
        );
    if (state.status === "error")
        return (
            <section role="alert" className={styles.error}>
                <h2>Recently viewed pieces could not be loaded.</h2>
                <p>Please try again.</p>
                <button
                    type="button"
                    onClick={() => setRetry((value) => value + 1)}
                >
                    Try again
                </button>
            </section>
        );
    if (!state.products.length)
        return (
            <section
                className={styles.empty}
                aria-labelledby="history-empty-title"
            >
                <h2 id="history-empty-title">No recently viewed pieces.</h2>
                <p>Pieces you view will appear here.</p>
                <Link href="/browse">Explore the collection</Link>
            </section>
        );
    return (
        <div className={styles.products}>
            <ProductList products={state.products} variant="editorial" />
            <DiscoveryPagination
                page={state.page}
                totalPages={state.totalPages}
                base="/profile/history"
                label="View history pagination"
            />
        </div>
    );
}
