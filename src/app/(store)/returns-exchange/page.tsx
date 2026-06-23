import type { Metadata } from "next";
import SupportForm from "@/components/store/support/support-form";
import { RETURNS_POLICY_SUMMARY } from "@/components/store/static/content/returns";

export const metadata: Metadata = { title: "Returns & Exchange | Marketplace" };

/**
 * Renders the Returns & Exchange request page.
 *
 * Displays a returns policy summary and a form for submitting return and exchange requests.
 */
export default function ReturnsExchangePage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Returns &amp; Exchange</h1>

            <section className="mb-8 rounded-md border bg-muted/30 p-4">
                <h2 className="mb-2 text-lg font-semibold">
                    {RETURNS_POLICY_SUMMARY.title}
                </h2>
                <p className="mb-3 text-sm text-muted-foreground">
                    {RETURNS_POLICY_SUMMARY.intro}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                    {RETURNS_POLICY_SUMMARY.points.map((point, index) => (
                        <li key={`${point}-${index}`}>{point}</li>
                    ))}
                </ul>
            </section>

            <SupportForm
                category="RETURN_REQUEST"
                submitLabel="返品・交換を申請する"
            />
        </main>
    );
}
