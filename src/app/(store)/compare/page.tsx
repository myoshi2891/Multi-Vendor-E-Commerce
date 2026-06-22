import type { Metadata } from "next";
import CompareGrid from "@/components/store/compare/compare-grid";

export const metadata: Metadata = { title: "Compare | Marketplace" };

/**
 * Renders the product comparison page.
 */
export default function ComparePage() {
    return (
        <main className="mx-auto max-w-6xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Compare products</h1>
            <CompareGrid />
        </main>
    );
}
