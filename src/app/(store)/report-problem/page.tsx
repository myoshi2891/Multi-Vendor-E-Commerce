import type { Metadata } from "next";
import SupportForm from "@/components/store/support/support-form";

export const metadata: Metadata = {
    title: "Report a Problem | Marketplace",
};

/**
 * Renders the report problem page with a form for users to submit problem reports.
 */
export default function ReportProblemPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Report a problem</h1>
            <SupportForm category="PROBLEM_REPORT" submitLabel="報告する" />
        </main>
    );
}
