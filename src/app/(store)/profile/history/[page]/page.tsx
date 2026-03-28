"use client";
import Pagination from "@/components/store/shared/pagination";
import ProductList from "@/components/store/shared/product-list";
import { getProductsByIds } from "@/queries/product";
import { ProductType } from "@/lib/types";
import { use, useEffect, useState } from "react";
export default function ProfileHistoryPage({
    params,
}: {
    params: Promise<{ page: string }>;
}) {
    const { page: pageParam } = use(params);
    const currentPage = Math.max(1, Math.floor(Number(pageParam)) || 1);
    const [products, setProducts] = useState<ProductType[]>([]);
    const [page, setPage] = useState<number>(currentPage);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            const historyString = localStorage.getItem("productHistory");
            if (!historyString) {
                setProducts([]);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const productHistory = JSON.parse(historyString) as string[];
                const res = await getProductsByIds(productHistory, currentPage);
                // getProductsByIds の戻り値は ProductList が期待する ProductType と構造互換
                setProducts(res.products as unknown as ProductType[]);
                setTotalPages(res.totalPages);
                setPage(currentPage);
            } catch (error) {
                if (error instanceof Error) {
                    console.error("Error fetching history:", error.message);
                }
                setProducts([]);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
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
