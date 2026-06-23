import type { Metadata } from "next";
import StaticPageLayout from "@/components/store/static/static-page-layout";
import { FAQ_SECTIONS } from "@/components/store/static/content/faqs";

export const metadata: Metadata = {
    title: "FAQs | Marketplace",
    description: "よくある質問と回答の一覧。",
};

/** よくある質問（Q&A）の静的ページ。各 Q を見出し、A を本文として描画する。 */
export default function FaqsPage() {
    return <StaticPageLayout title="FAQs" sections={FAQ_SECTIONS} />;
}
