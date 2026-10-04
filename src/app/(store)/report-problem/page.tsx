import type { Metadata } from "next";
import Link from "next/link";
import SupportForm from "@/components/store/support/support-form";
import DesignPage from "@/components/store/shared/design-page/design-page";
import { createSupportTicket } from "@/queries/support";
import styles from "@/components/store/shared/design-page/design-page.module.css";

export const metadata: Metadata = { title: "Report a Problem | Marketplace" };

/** Public form: action and existing validation remain on the server boundary. */
export default function ReportProblemPage() {
    return (
        <DesignPage
            title="Report a problem"
            eyebrow="HERE TO HELP"
            description="Tell us about a problem with your experience."
        >
            <section
                className={styles.support}
                aria-labelledby="problem-form-title"
                lang="ja"
            >
                <h2 id="problem-form-title">問題の報告</h2>
                <p>発生した問題と状況をお知らせください。</p>
                <SupportForm
                    submitAction={createSupportTicket}
                    category="PROBLEM_REPORT"
                    submitLabel="報告する"
                    appearance="brand"
                />
                <Link
                    href="/customer-service"
                    className={styles.supportLink}
                    lang="en"
                >
                    Customer service
                </Link>
            </section>
        </DesignPage>
    );
}
