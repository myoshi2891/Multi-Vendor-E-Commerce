import type { Metadata } from "next";
import StaticPageLayout from "@/components/store/static/static-page-layout";
import { LEGAL_SECTIONS } from "@/components/store/static/content/legal";

export const metadata: Metadata = {
    title: "Legal & Privacy | Marketplace",
    description: "利用規約・プライバシーポリシー・特定商取引法に基づく表記。",
};

/** 利用規約・プライバシー・特商法表記の静的ページ。長文のため目次を表示する。 */
export default function LegalPage() {
    return (
        <StaticPageLayout
            title="Legal & Privacy"
            sections={LEGAL_SECTIONS}
            withToc
        />
    );
}
