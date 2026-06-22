import type { Metadata } from "next";
import SupportForm from "@/components/store/support/support-form";

export const metadata: Metadata = {
    title: "Report a Problem | Marketplace",
};

/** 問題報告（Report a Problem）フォーム。公開（ゲスト可）。
 *  DB 書込は server action 側のため force-dynamic 不要。 */
export default function ReportProblemPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Report a problem</h1>
            <SupportForm category="PROBLEM_REPORT" submitLabel="報告する" />
        </main>
    );
}
