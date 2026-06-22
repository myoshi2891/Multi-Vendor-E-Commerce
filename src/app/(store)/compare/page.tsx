import type { Metadata } from "next";
import CompareGrid from "@/components/store/compare/compare-grid";

export const metadata: Metadata = { title: "Compare | Marketplace" };

/**
 * 商品比較ページ。比較リスト（localStorage）はクライアントにあるため
 * CompareGrid（client）が useCompareStore を読み getProductsByIds で取得する。
 * src/queries を render 時に直接呼ばないため force-dynamic は不要。
 */
export default function ComparePage() {
    return (
        <main className="mx-auto max-w-6xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Compare products</h1>
            <CompareGrid />
        </main>
    );
}
