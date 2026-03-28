"use client";
import Pagination from "@/components/store/shared/pagination";
import ProductList from "@/components/store/shared/product-list";
import { getProductsByIds } from "@/queries/product";
import { ProductType } from "@/lib/types";
import { use, useEffect, useState } from "react";
/**
 * Renders the "Your product view history" page and its paginated product list.
 *
 * Loads product IDs from localStorage, resolves the provided `params` promise to determine the current page, fetches the corresponding product data, and displays a loading state, the product list with pagination, or an empty state when no history exists.
 *
 * @param params - A promise that resolves to an object with a `page` string used to compute the current page number.
 * @returns The React element for the profile history page including header, loading indicator, product list with pagination, or an empty message.
 */
export default function ProfileHistoryPage({
    params,
}: {
    params: Promise<{ page: string }>;
}) {
    const { page: pageParam } = use(params);
    const raw = Number(pageParam);
    const currentPage = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
    const [products, setProducts] = useState<ProductType[]>([]);
    const [page, setPage] = useState<number>(currentPage);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchHistory = async () => {
            const historyString = localStorage.getItem("productHistory");
            if (!historyString) {
                if (!cancelled) {
                    setProducts([]);
                    setLoading(false);
                }
                return;
            }

            try {
                setLoading(true);
                const parsed: unknown = JSON.parse(historyString);
                const productHistory = Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")
                    ? parsed
                    : [];
                if (productHistory.length === 0) {
                    if (!cancelled) {
                        setProducts([]);
                        setLoading(false);
                    }
                    return;
                }
                const res = await getProductsByIds(productHistory, currentPage);
                if (!cancelled) {
                    setProducts(res.products);
                    setTotalPages(res.totalPages);
                    setPage(currentPage);
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error("[ProfileHistory] Error fetching history:", error.message, error.stack);
                } else {
                    console.error("[ProfileHistory] Error fetching history:", error);
                }
                if (!cancelled) {
                    setProducts([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        fetchHistory();

        return () => { cancelled = true; };
    }, [currentPage]);
    return (
        <div className="bg-white px-6 py-4">
            <h1 className="mb-3 text-lg font-bold">
                Your product view history
            </h1>
            {loading ? (
                <div>loading...</div>
            ) : products.length > 0 ? (
                <div className="pb-16">
                    <ProductList products={products} />
                    <div className="mt-2">
                        <Pagination
                            page={page}
                            setPage={setPage}
                            totalPages={totalPages}
                        />
                    </div>
                </div>
            ) : (
                <div>No products</div>
            )}
        </div>
    );
}
