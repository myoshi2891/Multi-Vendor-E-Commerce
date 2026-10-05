import type { Metadata } from "next";
import DesignPage from "@/components/store/shared/design-page/design-page";
import { LEGAL_SECTIONS } from "@/components/store/static/content/legal";
import styles from "./legal.module.css";
export const metadata: Metadata = {
    title: "Legal & Privacy | Marketplace",
    description: "利用規約・プライバシーポリシー・特定商取引法に基づく表記。",
};
// Keep the existing heading-derived fragment URLs stable during the visual migration.
const anchors = [
    "terms-of-service",
    "privacy-policy",
    "commercial-transaction-act",
] as const;
export default function LegalPage() {
    return (
        <DesignPage
            title="Legal & Privacy"
            eyebrow="INFORMATION & PRIVACY"
            description="利用規約・プライバシーポリシー・特定商取引法に基づく表記。"
        >
            <div className={styles.layout}>
                <nav aria-label="Legal contents" className={styles.contents}>
                    <p>Contents</p>
                    {LEGAL_SECTIONS.map((section, index) => (
                        <a key={anchors[index]} href={`#${anchors[index]}`}>
                            {section.heading}
                        </a>
                    ))}
                </nav>
                <div className={styles.sections}>
                    {LEGAL_SECTIONS.map((section, index) => (
                        <section
                            key={anchors[index]}
                            id={anchors[index]}
                            tabIndex={-1}
                            aria-labelledby={`${anchors[index]}-title`}
                            className={styles.section}
                        >
                            <h2 id={`${anchors[index]}-title`}>
                                {section.heading}
                            </h2>
                            {section.body.split("\n\n").map((paragraph, i) => (
                                <p key={i} lang="ja">
                                    {paragraph}
                                </p>
                            ))}
                        </section>
                    ))}
                </div>
            </div>
        </DesignPage>
    );
}
