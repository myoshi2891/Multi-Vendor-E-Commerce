import type { Metadata } from "next";
import Link from "next/link";
import SupportForm from "@/components/store/support/support-form";
import DesignPage from "@/components/store/shared/design-page/design-page";
import { createSupportTicket } from "@/queries/support";
import styles from "@/components/store/shared/design-page/design-page.module.css";

export const metadata: Metadata = { title: "Order Dispute | Marketplace" };

/** Public form: action and existing validation remain on the server boundary. */
export default function DisputePage() {
    return <DesignPage title="Order dispute resolution" eyebrow="HERE TO HELP" description="Tell us about an issue with your order.">
        <section className={styles.support} aria-labelledby="dispute-form-title" lang="ja">
            <h2 id="dispute-form-title">注文についての申立</h2>
            <p>対象の注文番号と申立内容をお知らせください。</p>
            <SupportForm submitAction={createSupportTicket} category="DISPUTE" submitLabel="申立を送信する" appearance="brand" />
            <Link href="/customer-service" className={styles.supportLink} lang="en">Customer service</Link>
        </section>
    </DesignPage>;
}
