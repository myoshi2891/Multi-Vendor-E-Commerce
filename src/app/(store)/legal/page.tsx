import type { Metadata } from "next";
import DesignPage from "@/components/store/shared/design-page/design-page";
import { LEGAL_SECTIONS } from "@/components/store/static/content/legal";
import { sectionAnchorId } from "@/components/store/static/static-page-layout";
import styles from "./legal.module.css";
export const metadata: Metadata = {
    title: "Legal & Privacy | Marketplace",
    description: "利用規約・プライバシーポリシー・特定商取引法に基づく表記。",
};
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
                    {LEGAL_SECTIONS.map((section) => (
                        <a
                            key={sectionAnchorId(section)}
                            href={`#${sectionAnchorId(section)}`}
                        >
                            {section.heading}
                        </a>
                    ))}
                </nav>
                <div className={styles.sections}>
                    {LEGAL_SECTIONS.map((section) => {
                        const anchor = sectionAnchorId(section);
                        return (
                            <section
                                key={anchor}
                                id={anchor}
                                tabIndex={-1}
                                aria-labelledby={`${anchor}-title`}
                                className={styles.section}
                            >
                                <h2 id={`${anchor}-title`}>
                                    {section.heading}
                                </h2>
                                {section.body
                                    .split("\n\n")
                                    .map((paragraph, i) => (
                                        <p key={`${anchor}-${i}`} lang="ja">
                                            {paragraph}
                                        </p>
                                    ))}
                            </section>
                        );
                    })}
                </div>
            </div>
        </DesignPage>
    );
}
