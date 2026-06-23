import type { Metadata } from "next";
import StaticPageLayout from "@/components/store/static/static-page-layout";
import { FAQ_SECTIONS } from "@/components/store/static/content/faqs";

export const metadata: Metadata = {
    title: "FAQs | Marketplace",
    description: "よくある質問と回答の一覧。",
};

/**
 * Displays the frequently asked questions page.
 */
export default function FaqsPage() {
    return <StaticPageLayout title="FAQs" sections={FAQ_SECTIONS} />;
}
