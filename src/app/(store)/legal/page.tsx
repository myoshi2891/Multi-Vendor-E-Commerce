import type { Metadata } from "next";
import StaticPageLayout from "@/components/store/static/static-page-layout";
import { LEGAL_SECTIONS } from "@/components/store/static/content/legal";

export const metadata: Metadata = {
    title: "Legal & Privacy | Marketplace",
    description: "利用規約・プライバシーポリシー・特定商取引法に基づく表記。",
};

/**
 * Displays legal policies, privacy information, and commercial law disclosures.
 *
 * Includes a table of contents for navigation through the lengthy content.
 */
export default function LegalPage() {
    return (
        <StaticPageLayout
            title="Legal & Privacy"
            sections={LEGAL_SECTIONS}
            withToc
        />
    );
}
